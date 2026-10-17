# Custom inputs

Upload exactly one artwork and at least one product specification or rulebook. Assign roles explicitly in the upload dialog. Use one representation of each reference document, not PDF/JSON/CSV duplicates together unless demonstrating a real conflict.

## Product JSON

```json
{
  "status": "Approved for this review",
  "product": {
    "brand": "Example",
    "name": "Oat Drink",
    "variant": "Original",
    "net_quantity": {"value": 1000, "unit": "mL"},
    "ingredients": "Water, oats, salt.",
    "allergen_statement": "Contains oats.",
    "storage_statement": "Refrigerate after opening.",
    "manufacturer": "Example Foods",
    "customer_care": "hello@example.com"
  },
  "nutrition": {
    "basis": {"value": 100, "unit": "mL"},
    "energy_kj": 196,
    "energy_kcal": 47,
    "fat_g": 1.5,
    "protein_g": 1.1
  }
}
```

A `facts` array of `{ "field": "net_quantity", "value": "1000 mL" }` is also supported. CSV uses `field,value,unit` headers. The included examples are fictional values, not label advice.

Spreadsheet extraction recognizes adjacent label/value cells for supported English field names. Nutrition variant tables need explicit confirmation. Other layouts may require AI interpretation or remain unverified.

A clearly tabular product-family sheet can also be screened for sibling-SKU copy when it has recognizable headers such as `SKU`, `Variant`/`Flavor`, `Ingredients`, `Allergen Statement`, `Net Quantity`/`Package Size`, and `UPC`/`Barcode`. Matching another row creates a reviewer prompt with cell evidence; it is not automatically a defect.

## Required bilingual copy pairs

If a product requires exact approved copy in more than one language, include the owner-approved phrases in the product JSON. PackSignal checks exact wording only:

```json
{
  "translation_pairs": [
    {
      "id": "almond-allergen-warning",
      "required": true,
      "status": "APPROVED",
      "translations": {
        "en": "Contains almonds.",
        "fr": "Contient des amandes."
      }
    }
  ]
}
```

Use two-letter language codes, provide every required version, and set \`status\` to \`APPROVED\` only after the source owner has approved the pair. The reviewer must also confirm source authority. A phrase not found in artwork remains *Unable to verify* until the reviewer confirms both source authority and complete artwork coverage. This exact-copy check does not translate, assess grammar, or determine whether messages have equivalent meaning or regulatory effect.

## Rulebook JSON

```json
{
  "rules": [
    {
      "id": "quantity-1",
      "title": "Net quantity",
      "field": "net_quantity",
      "comparison": "quantity_equivalence",
      "rule_text": "Displayed net quantity must match the approved product specification.",
      "literal_expected": null,
      "panel": "all",
      "source_section": "Section 1"
    },
    {
      "id": "required-copy-1",
      "title": "Required storage copy",
      "field": "storage_statement",
      "comparison": "exact_copy",
      "rule_text": "Include the supplied after-opening storage instruction.",
      "literal_expected": null,
      "panel": "back"
    }
  ]
}
```

Supported comparison names: `exact_phrase`, `all_phrases`, `quantity_equivalence`, `exact_copy`, `numeric_pair_and_basis`, `numeric_and_basis`, `all_approved_fields`, `register_lookup`, `required_phrase`, `forbidden_phrase`. These names are bounded operators, not arbitrary executable code. Unsupported operators remain unverified. Panel location is handled separately as a human confirmation.

`literal_expected` can specify a string or array of required phrases. A null value means use source facts. `identity` combines brand/product name; `business_details` combines manufacturer/customer care; `nutrition.energy` combines kJ/kcal; `claims` uses the register.

For PDF/Word/text rulebooks, Gemini can propose structured interpretations. Without AI, requirement-like prose remains uncompiled and visible. All AI interpretations require reviewer confirmation.

## Claims JSON

```json
{"entries":[{"text":"Smooth & creamy","status":"APPROVED","conditions":"For the reviewed SKU only"},{"text":"100% recyclable","status":"REVIEW","evidence_reference":"Packaging assessment PR-104"}]}
```

The current local lookup recognizes register entries plus a bounded list of common claim phrases. Environmental-claim prompts can display a supplied evidence-reference string, but PackSignal does not open or authenticate that document. It does not automatically adjudicate conditions, substantiate claims, or detect every claim. Missing evidence and conditional approvals are sent to human review.

## Images and scans

Local mode renders them but does not pretend to perform OCR. AI mode sends artwork first in groups of three, up to 12 rendered pages total, and reports omitted or untranscribed pages. AI transcription always requires visual confirmation, and it cannot support a definite absence claim by itself.
