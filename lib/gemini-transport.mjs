// One provider credential per request. A retry never switches keys or providers.
const configNumber=(name,fallback,min,max)=>{
  const raw=process.env[name];if(raw===undefined||raw==='')return fallback;
  const value=Number(raw);return Number.isFinite(value)?Math.min(max,Math.max(min,Math.floor(value))):fallback;
};
const limits=()=>({
  maxAttempts:configNumber('GEMINI_MAX_ATTEMPTS',3,1,3),
  sessionLimit:configNumber('GEMINI_MAX_REQUESTS_PER_SESSION',20,1,100),
  minIntervalMs:configNumber('GEMINI_MIN_INTERVAL_MS',6000,1000,60000),
});
let outboundAttempts=0,lastStartedAt=0,cooldownReason='',lastOutcome='No live request yet';
const keyCooldowns=new Map();
let serial=Promise.resolve();
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const error=(message,code,retryAt)=>Object.assign(new Error(message),{code,...(retryAt?{retryAt:new Date(retryAt).toISOString()}:{})});

export function geminiStatus(){
  const policy=limits();
  const now=Date.now();
  const activeCooldowns=[...keyCooldowns.entries()].filter(([_,time])=>time>now);
  const maxCooldown=activeCooldowns.length?Math.max(...activeCooldowns.map(([_,t])=>t)):null;
  return {...policy,outboundAttempts,remainingAttempts:Math.max(0,policy.sessionLimit-outboundAttempts),
    cooldownUntil:maxCooldown?new Date(maxCooldown).toISOString():null,cooldownReason:activeCooldowns.length?cooldownReason:null,
    lastOutcome,provider:'Gemini',policy:'Multi-key failover pool. Requests automatically balance and failover across configured keys.'};
}

function providerDelay(response,payload,now){
  const delays=[],header=response.headers.get('retry-after');
  if(header){const seconds=Number(header),date=Date.parse(header);if(Number.isFinite(seconds))delays.push(Math.max(0,seconds*1000));else if(Number.isFinite(date))delays.push(Math.max(0,date-now));}
  const details=Array.isArray(payload?.error?.details)?payload.error.details:[];
  for(const detail of details){
    if(!String(detail?.['@type']||'').endsWith('google.rpc.RetryInfo'))continue;
    const duration=detail.retryDelay;
    if(typeof duration==='string'&&/^\d+(?:\.\d+)?s$/.test(duration))delays.push(Number(duration.slice(0,-1))*1000);
    else if(duration&&typeof duration==='object'){
      const seconds=Number(duration.seconds||0),nanos=Number(duration.nanos||0);
      if(Number.isFinite(seconds)&&Number.isFinite(nanos)&&seconds>=0&&nanos>=0)delays.push(seconds*1000+nanos/1e6);
    }
  }
  return delays.length?Math.max(...delays):null;
}

function classifyQuota(payload){
  const details=Array.isArray(payload?.error?.details)?payload.error.details:[];
  const violations=details.filter(d=>String(d?.['@type']||'').endsWith('google.rpc.QuotaFailure')).flatMap(d=>Array.isArray(d.violations)?d.violations:[]);
  return violations.some(v=>Number(v.quotaValue)===0||/per.?day|daily/i.test(String(v.quotaId||v.quotaMetric||'')));
}

async function send(key,model,body,fetcher){
  const policy=limits(),deadline=Date.now()+120000;let waited=0;
  for(let attempt=1;attempt<=policy.maxAttempts;attempt++){
    if(outboundAttempts>=policy.sessionLimit)throw error('The local session request allowance is used. Exact checks remain available. Review the request allowance in Settings.','LOCAL_REQUEST_LIMIT');
    const remainingCooldown=(keyCooldowns.get(key)||0)-Date.now();
    if(remainingCooldown>0)throw error('Gemini credential is cooling down after a provider limit or outage. Alternative keys will be tried if configured.','PROVIDER_COOLDOWN',keyCooldowns.get(key));
    const pace=Math.max(0,lastStartedAt+policy.minIntervalMs-Date.now());
    if(pace)await pause(pace);
    const timeout=Math.min(60000,deadline-Date.now());
    if(timeout<1000)throw error('The bounded AI request time was reached. Exact checks remain available.','AI_TIME_LIMIT');
    outboundAttempts++;lastStartedAt=Date.now();lastOutcome='Request in progress';
    let response;
    try{
      response=await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
        method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},signal:AbortSignal.timeout(timeout),body,
      });
    }catch(cause){
      lastOutcome=cause?.name==='TimeoutError'?'Timed out':'Network unavailable';
      throw error(cause?.name==='TimeoutError'?'AI request timed out. It was not retried because the provider may have processed it.':'Could not reach Gemini. Check the connection; exact checks remain available.','AI_CONNECTION');
    }
    let payload;
    try{payload=await response.json();}catch{lastOutcome='Unreadable response';throw error('Gemini returned an unreadable response. Exact checks remain available.','AI_RESPONSE');}
    if(response.ok){lastOutcome='Live request completed';return {payload,transport:{attempts:attempt,cacheHit:false,provider:'Gemini'}};}
    lastOutcome=`HTTP ${response.status}`;
    if(![429,503].includes(response.status)){
      const reasons={400:'Gemini rejected the key, request, or output schema. Check the key and model.',401:'The API key was rejected.',403:'The key or project does not have access.',404:'The configured model is unavailable.',500:'Gemini could not process this request.'};
      throw error(reasons[response.status]||`AI request failed (HTTP ${response.status}).`,'GEMINI_HTTP_'+response.status);
    }
    const hint=providerDelay(response,payload,Date.now()),quotaUnavailable=response.status===429&&classifyQuota(payload);
    const delay=hint??(response.status===429?60000:1000*2**(attempt-1)+Math.floor(Math.random()*500));
    const canRetry=!quotaUnavailable&&attempt<policy.maxAttempts&&outboundAttempts<policy.sessionLimit&&waited+delay<=30000&&Date.now()+Math.max(delay,policy.minIntervalMs)+1000<deadline;
    if(!canRetry){
      // Preserve a provider's requested delay, even when it exceeds our retry budget.
      const cdTime=Date.now()+Math.max(delay,quotaUnavailable?300000:response.status===429?60000:30000);
      keyCooldowns.set(key,cdTime);
      cooldownReason=response.status===429?'Project/key quota reached':'Provider temporarily unavailable';
      throw error(`${cooldownReason}. Work on this key paused; failover to other configured keys.`,'GEMINI_HTTP_'+response.status,cdTime);
    }
    waited+=delay;lastOutcome=`Waiting before retry ${attempt+1} of ${policy.maxAttempts}`;
    await pause(delay);
  }
}

export function geminiRequest(key,model,body,fetcher=fetch){
  const result=serial.then(async()=>{
    const before=outboundAttempts;
    try{return await send(key,model,body,fetcher);}
    catch(cause){if(cause&&typeof cause==='object')cause.attempts=outboundAttempts-before;throw cause;}
  });serial=result.catch(()=>{});return result;
}
