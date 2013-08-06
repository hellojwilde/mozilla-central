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
  get _saveButton () { return document.getElementById("bookmark-save-changes"); },
  get _deleteButton () { return document.getElementById("bookmark-delete"); },

  _updateFlyoutTask: function B__updateFlyoutTask() {
    let isStarred = yield Browser.isSiteStarred();
    let tab = Browser.selectedTab;
    let self = BookmarkUI;

    self._preview.label = Browser.selectedBrowser.contentTitle;
    self._preview.url = Browser.selectedBrowser.currentURI;
    View.prototype._gotIcon(self._preview, tab.browser.mIconURL);

    self._deleteButton.hidden = !isStarred;
    self._saveButton.label = isStarred ? "Save Changes" : "Add Bookmark";

    self._noThumbnail.hidden = tab.snippets.images.length == 0;

    if (self._noThumbnail.checked || self._noThumbnail.hidden) {
      self._preview.removeAttribute("tiletype");
      self._preview.backgroundImageSet = [];
    } else {
      self._preview.setAttribute("tiletype", "thumbnail");
      self._preview.backgroundImageSet = tab.snippets.images;
    }
  },

  showFlyout: function B_showFlyout() {
    Task.spawn(this._updateFlyoutTask).
      then(() => this._flyout.openFlyout(this._starButton, "before_center"));
  },

  hideFlyout: function B_hideFlyout() {
    this._flyout.hideFlyout();
  },

  resetNoThumbnail: function B_resetNoThumbnail() {
    this._noThumbnail.checked = false;
  },

  onNoThumbnailChange: function B_onNoThumbnailChange() {
    Task.spawn(this._updateFlyoutTask).
      then(() => this._flyout.anchorAt(this._starButton, "before_center"));
  },

  onSaveChangesButton: function B_onSaveChangesButton() {
    Browser.starSite().
      then(() => {
        this.hideFlyout();
        this._updateStarButton();
      });
  },

  onDeleteButton: function B_onDeleteButton () {
    Browser.unstarSite().
      then(() => {
        this.hideFlyout();
        this._updateStarButton();
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
        this.resetNoThumbnail();
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