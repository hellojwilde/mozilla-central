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
function BookmarkFlyout(aPanel, aPopup) {
  PagedFlyout.call(this, aPanel, aPopup);

  // Make sure we don't hide when the user types into the create list textbox.
  this._wantTypeBehind = true;

  this.registerPage("bookmark", new BookmarkBookmark(this, aPopup));
  this.registerPage("lists", new BookmarkLists(this, aPopup));
}

BookmarkFlyout.prototype = Util.extend(Object.create(PagedFlyout.prototype), {
  selectPage: function HF_selectPage() {
    let self = this;
    return Task.spawn(function HUI_updateTask() {
      let uri = Browser.selectedBrowser.currentURI;
      let options = {
        id: yield Bookmarks.getForURI(uri),
        list: yield Browser.getSiteList()
      };

      if (!options.id) {
        options.id = yield Browser.starSite();
        options.saved = true;
      }

      self.displayPage("bookmark", options);
    });
  }
});

BookmarkFlyout.prototype.constructor = BookmarkFlyout;

/**
 * Controller for the page that lets users twiddle settings about the bookmark.
 */

function BookmarkBookmark(aFlyout, aFlyoutElement) {
  this._flyout = aFlyout;
  this._page = aFlyoutElement.querySelector(".bookmark-page-bookmark");

  this._picker = new TilePicker(this._page.querySelector(".tilepicker"));
  this._picker.parent = this;

  this._removeButton = this._page.querySelector(".bookmark-remove-button");
  this._listButton = this._page.querySelector(".bookmark-list-button");

  // XXX this isn't a super clean way to do this.
  this._flyout._panel.addEventListener("popuphidden", this.onFlyoutHidden.bind(this), false);
  this._removeButton.addEventListener("command", this.onRemoveButton.bind(this), false);
  this._listButton.addEventListener("click", this.onListButton.bind(this), false);
}

BookmarkBookmark.prototype = {
  display: function display(aOptions) {
    let { id, saved, noRemove, list } = aOptions || {};

    this._saved = saved;
    this._id = id;
    this._noRemove = noRemove || saved;

    Util.setBoolAttribute(this._page, "saved", this._saved);
    Util.setBoolAttribute(this._page, "noremove", this._noRemove);

    this._list = list;
    this._listButton.label = this._list.title;

    this._picker.title = PlacesUtils.bookmarks.getItemTitle(id);
    this._picker.uri = Browser.selectedBrowser.currentURI;
    this._picker.imageSnippets = Browser.selectedTab.snippets.ImageSnippet;

    try {
      let settings = JSON.parse(PlacesUtils.annotations.
                                getItemAnnotation(id, kThumbAnno));

      if (settings.isThumbnail) {
        this._picker.selectedImageSnippet = settings.selectedImageSnippet;
        this._picker.isThumbnail = settings.isThumbnail;
      }
    } catch (e) { /* there was no snippet data */ }
  },

  onListButton: function () {
    let options = {
      selected: this._list,
      noRemove: this._noRemove,
      id: this._id
    };

    this._flyout.displayPage("lists", options);
    this._flyout.realign();
  },

  onRemoveButton: function () {
    let self = this;
    return Task.spawn(function HE_onRemoveButton () {
      // Make sure we stop messing with the bookmark now that we're deleting it.
      self.active = false;
      self._flyout.hide();

      yield Browser.unstarSite();
      yield Appbar.update();
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

    let bookmarks = PlacesUtils.bookmarks;
    let listId = bookmarks.getFolderIdForItem(this._id);
    if (listId != this._list.id) {
      bookmarks.moveItem(this._id, this._list.id, bookmarks.DEFAULT_INDEX);
    }
  }
}

/**
 * Controller for the page that lets users manually select the list
 * to add the item to.
 */

function BookmarkLists(aFlyout, aFlyoutElement) {
  this._flyout = aFlyout;
  this._page = aFlyoutElement.querySelector(".bookmark-page-lists");

  this._list = this._page.querySelector("richlistbox");
  this._createTextbox = this._page.querySelector(".bookmark-lists-create > textbox");
  this._createButton = this._page.querySelector(".bookmark-lists-create > button");

  this.populateLists();
  this._createButton.addEventListener("command", this.onCreateButton.bind(this), false);
}

BookmarkLists.prototype = {
  _selected: null,
  _items: [],

  display: function (aOptions) {
    let { selected, noRemove, id } = aOptions;

    this._selected = selected;
    this._noRemove = noRemove;
    this._id = id;
    this._createTextbox.value = "";

    this.selectList(selected.id);
  },

  selectList: function (aToSelectId) {
    for (let item of this._items) {
      if (item.id == aToSelectId) {
        this._list.selectedItem = item.element;
        break;
      }
    }
  },

  populateLists: function () {
    let lists = Bookmarks.getLists();

    this._items = [];
    while (this._list.firstChild) {
      this._list.removeChild(this._list.firstChild);
    }

    for (let list of lists) {
      let item = new BookmarkListsItem(list.id, list.title);
      item.parent = this;

      this._list.appendChild(item.element);
      this._items.push(item);
    }
  },

  onCreateButton: function () {
    let title = this._createTextbox.value;
    let listId = Bookmarks.addList(title);

    let item = new BookmarkListsItem(listId, title);
    item.parent = this;

    this._list.appendChild(item.element);
    this._items.push(item);

    this.onListSelect(item);
  },

  onListSelect: function (aListItem) {
    let options = { list: aListItem, noRemove: this._noRemove, id: this._id };
    this._flyout.displayPage("bookmark", options);
  }
}

function BookmarkListsItem(aId, aTitle) {
  this.id = aId;
  this.title = aTitle;
}

BookmarkListsItem.prototype = {
  _element: null,

  get element() {
    if (!this._element) {
      this._element = document.createElement("richlistitem");
      this._element.addEventListener("click", this, false);

      this._elementLabel = document.createElement("label");
      this._elementLabel.textContent = this.title;
      this._element.appendChild(this._elementLabel);
    }
    return this._element;
  },

  handleEvent: function (aEvent) {
    switch (aEvent.type) {
      case "click":
        if (this.parent && this.parent.onListSelect) {
          this.parent.onListSelect(this);
        }
        break;
    }
  }
}

let BookmarkUI = {
  get _panel() { return document.getElementById("bookmark-container"); },
  get _popup() { return document.getElementById("bookmark-popup"); },
  get _button() { return document.getElementById("star-button"); },

  __flyout: null,
  get _flyout() {
    if (!this.__flyout) {
      this.__flyout = new BookmarkFlyout(this._panel, this._popup);
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
      try{
      let rect = self._button.getBoundingClientRect();
      let position = {
        xPos: (rect.left + rect.right) / 2,
        yPos: Elements.toolbar.getBoundingClientRect().top,
        centerHorizontally: true,
        bottomAligned: true
      };

      yield self._flyout.selectPage();
      yield self._flyout.show(position);
      } catch (e) { Util.dumpLn(e);}
    });
  },

  /**
   * Event handlers.
   */

  onStarButton: function HUI_onStarButton() {
    return Task.spawn(function HUI_onStarButtonTask () {
      yield BookmarkUI.show();
      yield Appbar.update();
    });
  }
};
