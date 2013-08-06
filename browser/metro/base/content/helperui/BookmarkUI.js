/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var BookmarkUI = {
  init: function B_init() {
    this._initFlyout();
    this._initButtons();
  },

  /*********************************
   * Flyout
   */

  get _flyout() { return document.getElementById("bookmark"); },
  get _preview () { return document.getElementById("bookmark-preview"); },
  get _noThumbnail () { return document.getElementById("bookmark-nothumbnail"); },
  get _saveButton () { return document.getElementById("bookmark-save-changes"); },
  get _deleteButton () { return document.getElementById("bookmark-delete"); },

  _thumbnails: [],
  __thumbnailIndex: 0,

  get _thumbnailIndex () { return this.__thumbnailIndex; },
  set _thumbnailIndex (value) {
    this.__thumbnailIndex = value;
    if (!this._noThumbnail.checked) {
      let background = 'url("'+this._thumbnails[value].url+'")';
      this._preview.setAttribute("customImage", background);
      if (this._preview.refresh) {
        this._preview.refresh()
      }
      Util.dumpLn("thumb " + this._thumbnails[value].url);
    }
  },

  _initFlyout: function B__initFlyout() {
    this._preview.addEventListener("ThumbnailNext", this, false);
    this._preview.addEventListener("ThumbnailPrev", this, false);
  },

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
      self._preview.backgroundImage = null;
    } else {
      self._preview.setAttribute("tiletype", "thumbnail");
      self._thumbnails = tab.snippets.images;
      self._thumbnailIndex = 0;
    }
  },

  showFlyout: function B_showFlyout() {
    Task.spawn(this._updateFlyoutTask).
      then(() => this._flyout.openFlyout(this._starButton, "before_center"));
  },

  hideFlyout: function B_hideFlyout() {
    this._flyout.hideFlyout();
  },

  nextThumbnail: function B_nextThumbnail() {
    if (this._thumbnailIndex < this._thumbnails.length - 1) {
      this._thumbnailIndex++;
    }
  },

  prevThumbnail: function B_prevThumbnail() {
    if (this._thumbnailIndex > 0) {
      this._thumbnailIndex--;
    }
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
      case "ThumbnailNext":
        this.nextThumbnail();
        break;
      case "ThumbnailPrev":
        this.prevThumbnail();
        break;
    }
  }
};