export class List {
  constructor(id, labelOf, onSelect) {
    this.box = document.getElementById(id);
    this.labelOf = labelOf;
    this.onSelect = onSelect;
    this.items = [];

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

  select(item) {
    const index = this.items.indexOf(item);
    if (index === -1) return;
    [...this.box.children].forEach((option, i) => {
      option.selected = i === index;
    });
    return this.onSelect(item);
  }
}
