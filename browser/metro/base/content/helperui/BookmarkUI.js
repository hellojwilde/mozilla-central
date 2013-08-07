/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var BookmarkUI = {
  init: function B_init() {
    this._initSelectionStar();
    this._initButtons();
  },

  uninit: function B_uninit() {
    this._uninitSelectionStar();
  },

  /*********************************
   * Flyout
   */

  get _flyout() { return document.getElementById("bookmark"); },
  get _preview () { return document.getElementById("bookmark-preview"); },
  get _noThumbnail () { return document.getElementById("bookmark-nothumbnail"); },
  get _addButton () { return document.getElementById("bookmark-add"); },
  get _saveButton () { return document.getElementById("bookmark-save-changes"); },
  get _deleteButton () { return document.getElementById("bookmark-delete"); },

  _flyoutModel: {},

  _loadFlyoutModelTask: function B__loadFlyoutModelTask() {
    let browser = Browser.selectedBrowser;
    let model = this._flyoutModel = {
      isStarred: yield Browser.isSiteStarred(),
      url: browser.currentURI,
      images: tab.snippets.images || []
    };

    if (model.isStarred) {
      let id = yield Bookmarks.getForURI(model.url);
      let anno = PlacesUtils.annotations.getItemAnnotation(id, "snippets");
      let snippets = JSON.parse(anno || "{}");

      model.label = PlacesUtils.bookmarks.getItemTitle(id);
      model.icon = yield Bookmarks.getFaviconForURI(model.url);

      model.noImage = snippets.noImage;
      model.imageIndex = -1;
      model.images.forEach(function (item, index) {
        if (snippets.image.url == item.url) {
          model.imageIndex = index;
        }
      });
      if (model.imageIndex == -1) {
        model.imageIndex = model.images.length;
        model.images.push(snippets.image);
      }
    } else {
      model.label = browser.contentTitle;
      model.icon = browser.mIconURL;

      model.noImage = false;
      model.imageIndex = 0;
    }
  },

  _saveFlyoutModelTask: function B__saveFlyoutModelTask() {
    // TODO: sync all of these changes to places.
  },

  _updateFlyout: function B__updateFlyout() {
    let model = this._flyoutModel;

    this._preview.label = model.label;
    this._preview.url = model.url;
    View._prototype._gotIcon(this._preview, model.icon);

    if (model.noImage) {
      this._preview.removeAttribute("tiletype");
    } else {
      this._preview.addAttribute("tiletype", "thumbnail");
    }

    this._preview.backgroundImageSet = model.images;
    this._preview.backgroundImageIndex = model.imageIndex;

    this._addButton.hidden = model.isStarred;
    this._deleteButton.hidden = this._saveButton.hidden = !model.isStarred;

    this._flyout.anchorAt(this._starButton, "before_center", 0, -10);
  },

  showFlyout: function B_showFlyout() {
    this._updateFlyout();
    this._flyout.openFlyout(this._starButton, "before_center", 0, -10);
  },

  hideFlyout: function B_hideFlyout() {
    this._flyout.hideFlyout();
  },

  onNoThumbnailChange: function B_onNoThumbnailChange() {
    this._flyoutModel.noImage = this._noThumbnail.checked;
    this._updateFlyout();
  },

  onAddButton: function B_onAddButton() {
    Task.spawn(function onAddButtonTask() {
      yield Browser.starSite();
      yield Task.spawn(BookmarkUI._saveFlyoutModelTask);
      BookmarkUI.hideFlyout();
    });
  },

  onSaveChangesButton: function B_onSaveChangesButton() {
    Task.spawn(function onSaveChangesButtonTask() {
      yield Task.spawn(BookmarkUI._saveFlyoutModelTask);
      BookmarkUI.hideFlyout();
    });
  },

  onDeleteButton: function B_onDeleteButton() {
    Task.spawn(function onDeleteButtonTask() {
      yield Browser.unstarSite();
      BookmarkUI._updateStarButton();
      BookmarkUI.hideFlyout();
    });
  },

  /*********************************
   * Selection Star
   */

  get _selectionStarButton() { return null; },

  _initSelectionStar: function B__initSelectionStar() {
    messageManager.addMessageListener("Content:SelectionRange", this);
  },

  _uninitSelectionStar: function B__uninitSelectionStar() {
    messageManager.removeMessageListener("Content:SelectionRange", this);
  },

  _onSelectionRangeChange: function B__onSelectionRangeChange(json) {
    alert("range change");
  },

  /*********************************
   * Star & Pin Buttons
   */

  get _pinButton() { return document.getElementById("pin-button"); },
  get _starButton() { return document.getElementById("star-button"); },

  _initButtons: function B__initButtons() {
    Elements.browsers.addEventListener('URLChanged', this, true);
    Elements.tabList.addEventListener('TabSelect', this, true);
    Elements.navbar.addEventListener('MozAppbarShowing', this, false);
  },

  updateButtons: function B_updateButtons() {
    this._updateStarButton();
    this._updatePinButton();
  },

  _updatePinButton: function B__updatePinButton() {
    this._pinButton.checked = Browser.isSitePinned();
  },

  _updateStarButton: function B__updateStarButton() {
    return Browser.isSiteStarred().
      then((isStarred) => this._starButton.checked = isStarred);
  },

  onPinButton: function B_onPinButton() {
    if (this._pinButton.checked) {
      Browser.pinSite();
    } else {
      Browser.unpinSite();
    }
  },

  onStarButton: function B_onStarButton() {
    this._updateStarButton().
      then(() => this.showFlyout());
  },

  /*********************************
   * Event Handling
   */

  handleEvent: function B_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "URLChanged":
      case "TabSelect":
      case "MozAppbarShowing":
        this.updateButtons();
        break;
    }
  },

  receiveMessage: function B_receiveMessage(aMessage) {
    let json = aMessage.json;
    switch (aMessage.name) {
      case "Content:SelectionRange":
        this._onSelectionRangeChange(json);
        break;
    }
  }
};