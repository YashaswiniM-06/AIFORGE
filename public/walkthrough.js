let activeTour=null;

export function stopWalkthrough(){activeTour?.();}

export async function startWalkthrough(steps){
  stopWalkthrough();
  const priorFocus=document.activeElement,card=document.createElement('aside');
  card.className='tour-card';card.setAttribute('role','region');card.setAttribute('aria-label','Guided walkthrough');
  card.innerHTML='<div class="tour-top"><span class="eyebrow" data-tour-count></span><button type="button" aria-label="Exit guided tour" data-tour-close>×</button></div><h2 tabindex="-1" data-tour-title></h2><p id="tour-description"></p><div class="tour-buttons"><button type="button" class="secondary" data-tour-prev>Back</button><button type="button" class="primary" data-tour-next>Next →</button></div>';
  document.body.append(card);
  let index=0,closed=false,busy=false,failed=false,target=null,oldDescription=null;const controller=new AbortController();
  const title=card.querySelector('[data-tour-title]'),description=card.querySelector('#tour-description'),next=card.querySelector('[data-tour-next]'),prev=card.querySelector('[data-tour-prev]');
  function releaseTarget(){if(!target)return;target.classList.remove('tour-target');if(oldDescription===null)target.removeAttribute('aria-describedby');else target.setAttribute('aria-describedby',oldDescription);target=null;}
  function place(){
    if(closed)return;const bounds=target?.getBoundingClientRect(),width=Math.min(360,window.innerWidth-24);card.style.width=width+'px';
    const height=card.getBoundingClientRect().height;
    let top=bounds?bounds.bottom+14:window.innerHeight-height-16,left=bounds?bounds.left:window.innerWidth-width-16;
    if(top+height>window.innerHeight-12)top=bounds&&bounds.top>height+24?bounds.top-height-14:window.innerHeight-height-16;
    card.style.left=Math.max(12,Math.min(left,window.innerWidth-width-12))+'px';card.style.top=Math.max(12,top)+'px';
  }
  function close(){if(closed)return;closed=true;controller.abort();releaseTarget();card.remove();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);document.removeEventListener('keydown',onKey);activeTour=null;if(priorFocus?.isConnected)priorFocus.focus();}
  function onKey(event){if(event.key==='Escape'){event.preventDefault();close();}}
  async function show(){
    if(closed||busy)return;busy=true;failed=false;releaseTarget();next.disabled=true;prev.disabled=true;title.textContent='Opening the next step…';description.textContent='The tour uses the organizer files and local checks, with no API request.';place();
    try{
      await steps[index].prepare?.({signal:controller.signal});if(closed)return;
      const step=steps[index];target=document.querySelector(step.selector);if(target){oldDescription=target.getAttribute('aria-describedby');target.classList.add('tour-target');target.setAttribute('aria-describedby','tour-description');target.scrollIntoView({block:'center',behavior:'instant'});}
      card.querySelector('[data-tour-count]').textContent=`PACKSIGNAL TOUR · ${index+1} / ${steps.length}`;
      title.textContent=step.title;description.textContent=step.text;next.textContent=index===steps.length-1?'Finish tour ✓':'Next →';prev.disabled=index===0;next.disabled=false;title.focus({preventScroll:true});place();
    }catch(error){if(closed)return;failed=true;title.textContent='The tour paused';description.textContent=error.message||'Could not open this step. Exit the tour and try again.';next.textContent='Retry step';next.disabled=false;prev.disabled=index===0;place();}
    finally{busy=false;}
  }
  next.addEventListener('click',()=>{if(busy)return;if(failed){show();return;}if(index===steps.length-1){close();return;}index++;show();});
  prev.addEventListener('click',()=>{if(!busy&&index>0){index--;show();}});
  card.querySelector('[data-tour-close]').addEventListener('click',close);
  window.addEventListener('resize',place);window.addEventListener('scroll',place,true);document.addEventListener('keydown',onKey);activeTour=close;await show();
}
