// A searchable drop-down list (calcite-combobox) of objects.
// labelOf(item) gives the text shown for an item; onSelect(item) runs when the user picks one.
export class List {
  constructor(id, labelOf, onSelect) {
    this.box = document.getElementById(id);
    this.labelOf = labelOf;
    this.onSelect = onSelect;
    this.items = [];

    // Each option's value is its index in `items`
    this.box.addEventListener('calciteComboboxChange', () => onSelect(this.items[this.box.value]));
  }

  setItems(items) {
    this.items = items;
    this.box.disabled = items.length === 0;
    this.box.replaceChildren(...items.map((item, i) => {
      const option = document.createElement('calcite-combobox-item');
      option.value = String(i);
      option.heading = this.labelOf(item);
      return option;
    }));
  }

  // Selects from code, when a land is picked on the map. Returns what onSelect returns, so it can be awaited.
  select(item) {
    const index = this.items.indexOf(item);
    if (index === -1) return;
    // The other options are cleared too, or the list keeps showing the old choice
    [...this.box.children].forEach((option, i) => {
      option.selected = i === index;
    });
    return this.onSelect(item);
  }
}
