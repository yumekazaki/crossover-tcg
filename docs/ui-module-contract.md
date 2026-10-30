# UI module contract

The root app owns document startup, layout shell and engine state. The card-browse module owns only its library/deck-builder panel and scoped CSS.

`createCardBrowser({cards, deck, onAdd, onRemove}) -> HTMLElement` renders a searchable/filterable card library, selected-card detail, deck list and current size/copy/type counts. It does not mutate engine or card records.

The module must support franchise, type, subtype, rarity and cost search filters; use only the cards argument; show a placeholder when an image is not locally approved; and leave actual deck legality enforcement to `validateDeck` from the data module. It can call the supplied callbacks and display their returned validation status.
