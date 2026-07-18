(function () {
  "use strict";

  const filters = {};

  function normalise(value) {
    return String(value === null || value === undefined ? "" : value)
      .toLowerCase()
      .trim();
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getFieldValue(row, field) {
    if (!row || !field) return "";
    if (typeof field.getValue === "function") return field.getValue(row);
    return row[field.value];
  }

  window.setupGlipTableFilter = function (options) {
    if (!options || !options.filterId || !options.tableId) return;
    if (filters[options.filterId]) return;

    const table = document.getElementById(options.tableId);
    if (!table) return;

    const fields = Array.isArray(options.fields) ? options.fields : [];

    filters[options.filterId] = {
      query: "",
      column: "all",
      fields: fields,
      countElement: null
    };

    const wrapper = document.createElement("div");
    wrapper.className = "glip-table-filter";
    wrapper.id = "glipTableFilter-" + options.filterId;

    wrapper.innerHTML = `
      <div class="glip-table-filter-row">
        <label class="glip-table-filter-field">
          <span>Search</span>
          <input
            type="search"
            class="tracker-input glip-table-filter-input"
            placeholder="Type to search..."
            autocomplete="off"
            spellcheck="false"
          >
        </label>

        <label class="glip-table-filter-field glip-table-filter-column">
          <span>Search in</span>
          <select class="tracker-input glip-table-filter-select">
            <option value="all">All columns</option>
            ${fields.map(function (field) {
              return '<option value="' + escapeHtml(field.value) + '">' +
                escapeHtml(field.label || field.value) +
                "</option>";
            }).join("")}
          </select>
        </label>

        <button type="button" class="glip-btn glip-btn-secondary glip-table-filter-clear">
          Clear
        </button>
      </div>

      <p class="glip-table-filter-count"></p>
    `;

    const parent = table.parentNode;
    parent.insertBefore(wrapper, table);

    const input = wrapper.querySelector(".glip-table-filter-input");
    const select = wrapper.querySelector(".glip-table-filter-select");
    const clearBtn = wrapper.querySelector(".glip-table-filter-clear");
    const count = wrapper.querySelector(".glip-table-filter-count");

    filters[options.filterId].countElement = count;

    function changed() {
      filters[options.filterId].query = normalise(input.value);
      filters[options.filterId].column = select.value || "all";

      if (typeof options.onChange === "function") {
        options.onChange();
      }
    }

    input.addEventListener("input", changed);
    select.addEventListener("change", changed);

    clearBtn.addEventListener("click", function () {
      input.value = "";
      select.value = "all";
      changed();
      input.focus();
    });
  };

  window.applyGlipTableFilter = function (filterId, rows) {
    const filter = filters[filterId];
    const sourceRows = Array.isArray(rows) ? rows : [];

    if (!filter) return sourceRows;

    const query = filter.query;
    const selectedColumn = filter.column;

    let filteredRows = sourceRows;

    if (query) {
      const fieldsToSearch =
        selectedColumn === "all"
          ? filter.fields
          : filter.fields.filter(function (field) {
              return field.value === selectedColumn;
            });

      filteredRows = sourceRows.filter(function (row) {
        return fieldsToSearch.some(function (field) {
          return normalise(getFieldValue(row, field)).indexOf(query) !== -1;
        });
      });
    }

    if (filter.countElement) {
      filter.countElement.textContent =
        "Showing " + filteredRows.length + " of " + sourceRows.length + " records";
    }

    return filteredRows;
  };
})();
