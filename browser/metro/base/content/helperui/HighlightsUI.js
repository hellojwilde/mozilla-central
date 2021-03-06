// -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; js2-basic-offset: 2; js2-skip-preprocessor-directives: t; -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const kThumbAnno = "snippets/tileThumbnail";

/**
 * Subclass of PagedFlyout that has an editing mode, preset pages,
 * and state updating.
 */
function HighlightsFlyout(aPanel, aPopup) {
  PagedFlyout.call(this, aPanel, aPopup);

  this.registerPage("empty", new HighlightsEmpty(this, aPopup));
  this.registerPage("bookmark", new HighlightsBookmark(this, aPopup));
  this.registerPage("list", new HighlightsList(this, aPopup));

  this._editButton = this._popup.querySelector(".highlights-edit-button");
  this._editButton.addEventListener("command", this.onEditButton.bind(this), false);

  this._backButton = this._popup.querySelector(".highlights-back-button");
  this._backButton.addEventListener("command", this.onBackButton.bind(this), false);
}

HighlightsFlyout.prototype = Util.extend(Object.create(PagedFlyout.prototype), {
  _isEditing: false,
  get isEditing() {
    delete this.isEditing;
    return this._isEditing;
  },

  selectPage: function HF_selectPage() {
    let self = this;
    return Task.spawn(function HUI_updateTask() {
      self.stopEditing();

      let uri = Browser.selectedBrowser.currentURI;
      let bookmarkId = yield Bookmarks.getForURI(uri);
      if (bookmarkId == null) {
        self.displayPage("empty");
        return;
      }

      let highlights = Browser.getHighlights(bookmarkId);
      if (highlights.length == 0) {
        self.displayPage("bookmark", { id: bookmarkId });
      } else {
        self.displayPage("list", { id: bookmarkId });
      }
    });
  },

  startEditing: function () {
    if (this._isEditing) {
      return;
    }

    this._isEditing = true;
    this._popup.setAttribute("editing", "true");
    this.realign();
  },

  stopEditing: function () {
    if (!this._isEditing) {
      return;
    }

    this._isEditing = false;
    this._popup.removeAttribute("editing");
    this.realign();
  },

  onEditButton: function HUI_onEditButton() {
    this.startEditing();
  },

  onBackButton: function HUI_onBackButton() {
    this.stopEditing();
  }
});

HighlightsFlyout.prototype.constructor = HighlightsFlyout;

/**
 * Controller for "empty" page shown when there is no bookmark or highlights.
 */
function HighlightsEmpty(aFlyout, aFlyoutElement) {
  this._flyout = aFlyout;
  this._page = aFlyoutElement.querySelector(".highlights-page-empty");

  this._markButton = this._page.querySelector(".highlights-bookmark-button");
  this._markButton.addEventListener("click", this.onMarkButton.bind(this), false);
}

HighlightsEmpty.prototype = {
  onMarkButton: function () {
    let self = this;
    return Task.spawn(function HE_onMarkButtonTask () {
      let bookmarkId = yield Browser.starSite();
      self._flyout.displayPage("bookmark", { id: bookmarkId, saved: true });
      self._flyout.realign();
      yield Appbar.update();
    });
  }
};

/**
 * Controller for "bookmark" page shown when there is a bookmark,
 * but no highlights.
 */
function HighlightsBookmark(aFlyout, aFlyoutElement) {
  this._flyout = aFlyout;

  this._page = aFlyoutElement.querySelector(".highlights-page-bookmark");
  this._picker = new TilePicker(this._page.querySelector(".tilepicker"));
  this._picker.parent = this;
  this._removeButton = this._page.querySelector(".highlights-remove-button");

  // XXX this isn't a super clean way to do this.
  this._flyout._panel.addEventListener("popuphidden", this.onFlyoutHidden.bind(this), false);
  this._removeButton.addEventListener("command", this.onRemoveButton.bind(this), false);
}

HighlightsBookmark.prototype = {
  display: function (aOptions) {
    let { id, saved } = aOptions || {};

    Util.setBoolAttribute(this._page, "saved", saved);

    this._id = id;

    this._picker.title = PlacesUtils.bookmarks.getItemTitle(id);
    this._picker.uri = Browser.selectedBrowser.currentURI;
    this._picker.imageSnippets = Browser.selectedTab.snippets.ImageSnippet;

    try {
      let json = PlacesUtils.annotations.getItemAnnotation(id, kThumbAnno);
      let settings = JSON.parse(json);

      this._picker.selectedImageSnippet = settings.selectedImageSnippet;
      this._picker.isThumbnail = settings.isThumbnail;
    } catch (e) { /* there was no snippet data */ }
  },

  onRemoveButton: function () {
    let self = this;
    return Task.spawn(function HE_onRemoveButton () {
      yield Browser.unstarSite();
      yield Appbar.update();
      self._flyout.hide();
    });
  },

  onTilePick: function () {
    this._flyout.realign();
  },

  onFlyoutHidden: function () {
    if (!this.active) {
      return;
    }

    let json = JSON.stringify({
      selectedImageSnippet: this._picker.selectedImageSnippet,
      isThumbnail: this._picker.isThumbnail
    });

    let anno = PlacesUtils.annotations;
    anno.setItemAnnotation(this._id, kThumbAnno, json, 0, anno.EXPIRE_NEVER);
  }
};

/**
 * Controller for "list" page shown when there is a bookmark and highlights.
 */
function HighlightsList(aFlyout, aFlyoutElement) {
  this._flyout = aFlyout;
  this._page = aFlyoutElement.querySelector(".highlights-page-list");

  this._deleteButton = this._page.querySelector(".highlights-delete-button");
  this._deleteButton.addEventListener("command", this.onDeleteButton.bind(this), false);
}

HighlightsList.prototype = {
  _items: [],
  _id: null,

  get _list() { return this._page.querySelector("richlistbox"); },

  display: function (aOptions) {
    let { id } = aOptions || {};
    let highlights = Browser.getHighlights(id);

    while (this._list.childNodes.length > 0) {
      this._list.removeChild(this._list.firstChild);
    }

    let items = [];
    for (let highlight of highlights) {
      let item = new HighlightsListItem(highlight, this);
      items.push(item);

      this._list.appendChild(item.element);
      item.elementCheckbox.addEventListener("command", this.onCheckbox.bind(this))
    }
    this._items = items;

    this.updateDeleteButton();
    this._id = id;
  },

  updateChecked: function () {
    this.updateDeleteButton();
  },

  updateDeleteButton: function () {
    let checked = this._items.filter((aItem) => aItem.checked);
    let len = checked.length;

    this._deleteButton.disabled = (len == 0);
    this._deleteButton.label = (len > 1) ? "Remove (" + len + ")" : "Remove";
  },

  onCheckbox: function () {
    this.updateDeleteButton();
  },

  onDeleteButton: function () {
    let self = this;
    return Task.spawn(function onDeleteButtonTask() {
      let checked = self._items.filter((aItem) => aItem.checked);
      for (let item of checked) {
        yield Browser.unhighlight(item.highlight);
      }

      if (yield Browser.isSiteStarred()) {
        self._flyout.selectPage();
        self._flyout.realign();
      } else {
        yield Appbar.update();
        self._flyout.hide();
      }
    });
  }
};

function HighlightsListItem(aHighlight, aList) {
  this.highlight = aHighlight;
  this._list = aList;
}

HighlightsListItem.prototype = {
  _element: null,
  _elementText: null,
  _elementCheckbox: null,

  get element() {
    if (!this._element) {
      this._render();
    }
    return this._element;
  },

  get elementCheckbox() {
    if (!this._elementCheckbox) {
      this._render();
    }
    return this._elementCheckbox;
  },

  get checked() { return this.elementCheckbox.checked; },
  set checked(aIsChecked) {
    this.elementCheckbox.checked = aIsChecked;
    this.updateChecked();
    return this.checked;
  },

  updateChecked: function () {
    Util.setBoolAttribute(this.element, "checked", this.checked);

    if (this._list && this._list.updateChecked) {
      this._list.updateChecked();
    }
  },

  onElement: function (aEvent) {
    // XXX there really should be a better way to fetch this without
    // violating multiple separate pseudo-private scopes.
    if (this._list._flyout._isEditing) {
      if (aEvent.originalTarget != this.elementCheckbox) {
        this.checked = !this.checked;
      }
    } else {
      Browser.scrollToHighlight(this.highlight);
    }
  },

  onCheckbox: function (aEvent) {
    this.updateChecked();
  },

  _render: function () {
    this._element = document.createElement("richlistitem");

    this._elementCheckbox = document.createElement("checkbox");
    this._element.appendChild(this._elementCheckbox);

    this._elementText = document.createElement("description");
    this._elementText.textContent =
      '"' + this.highlight.string.replace(/["��]/g, "'") + '"';
    this._element.appendChild(this._elementText);

    this._element.addEventListener("click", this.onElement.bind(this), false);
    this._elementCheckbox.addEventListener("command", this.onCheckbox.bind(this), false);
  }
};

let HighlightsUI = {
  get _panel() { return document.getElementById("highlights-container"); },
  get _popup() { return document.getElementById("highlights-popup"); },
  get _button() { return document.getElementById("star-button"); },

  __flyout: null,
  get _flyout() {
    if (!this.__flyout) {
      this.__flyout = new HighlightsFlyout(this._panel, this._popup);
      this.__flyout.controller = this;
    }
    return this.__flyout;
  },

  /**
   * Displays the popup, updated to match the current page.
   * @returns {Promise} Resolved when popup fully shown.
   */
  show: function HUI_show() {
    let self = this;
    return Task.spawn(function HUI_showTask() {
      try {
      let rect = self._button.getBoundingClientRect();
      let position = {
        xPos: (rect.left + rect.right) / 2,
        yPos: Elements.toolbar.getBoundingClientRect().top,
        centerHorizontally: true,
        bottomAligned: true
      };

      yield self._flyout.selectPage();
      yield self._flyout.show(position);
      } catch(e) {
        alert(e);
      }
    });
  },

  /**
   * Event handlers.
   */

  onStarButton: function HUI_onStarButton() {
    return Task.spawn(function HUI_onStarButtonTask () {
      yield Appbar.update();
      yield HighlightsUI.show();
    });
  }
};
