// Searchable dropdown built on a text input.
// labelOf(item) gives the text shown for an item; onSelect(item) runs when the user picks one.
export class Autocomplete {
  constructor(input, labelOf, onSelect) {
    this.input = input;
    this.labelOf = labelOf;
    this.onSelect = onSelect;
    this.placeholder = input.placeholder;
    this.items = [];
    this.matches = [];
    this.selected = null;

    const wrapper = document.createElement('div');
    wrapper.className = 'autocomplete';
    this.list = document.createElement('ul');
    this.list.className = 'autocomplete-list';
    this.list.hidden = true;
    input.replaceWith(wrapper);
    wrapper.append(input, this.list);

    input.autocomplete = 'off';

    // Empty the box on focus so the full list shows; the current choice stays as the placeholder
    input.addEventListener('focus', () => {
      input.placeholder = this.selected ? labelOf(this.selected) : this.placeholder;
      input.value = '';
      this.filter();
    });

    input.addEventListener('blur', () => {
      input.value = this.selected ? labelOf(this.selected) : '';
      input.placeholder = this.placeholder;
      this.list.hidden = true;
    });

    input.addEventListener('input', () => this.filter());

    // Enter takes the first match
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') this.select(this.matches[0]);
    });

    // mousedown fires before the input loses focus, so the pick is not lost on blur
    this.list.addEventListener('mousedown', event => {
      event.preventDefault();
      const li = event.target.closest('li');
      if (li) this.select(this.matches[li.dataset.index]);
    });
  }

  setItems(items) {
    this.items = items;
    this.selected = null;
    this.input.value = '';
    this.input.disabled = items.length === 0;
    this.list.hidden = true;
  }

  select(item) {
    if (!item) return;
    this.selected = item;
    this.input.value = this.labelOf(item);
    this.input.blur();
    this.onSelect(item);
  }

  filter() {
    const text = this.input.value.trim().toLowerCase();
    this.matches = this.items.filter(item => this.labelOf(item).toLowerCase().includes(text));

    const rows = this.matches.map((item, index) => {
      const li = document.createElement('li');
      li.textContent = this.labelOf(item);
      li.dir = 'auto';
      li.dataset.index = index;
      return li;
    });

    this.list.replaceChildren(...rows);
    this.list.scrollTop = 0;
    this.list.hidden = rows.length === 0;
  }
}
