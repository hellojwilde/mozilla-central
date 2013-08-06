/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var BookmarkUI = {
  get _flyout() { return document.getElementById("bookmark"); },
  get _preview () { return document.getElementById("bookmark-preview"); },
  get _noThumbnail () { return document.getElementById("bookmark-nothumbnail"); },
  get _saveButton () { return document.getElementById("bookmark-save-changes"); },
  get _deleteButton () { return document.getElementById("bookmark-delete"); },

  get _pinButton() { return document.getElementById("pin-button"); },
  get _starButton() { return document.getElementById("star-button"); },

  init: function B_init() {
    Elements.browsers.addEventListener('URLChanged', this, true);
    Elements.tabList.addEventListener('TabSelect', this, true);
    Elements.navbar.addEventListener('MozAppbarShowing', this, false);
  },

  /*********************************
   * Flyout
   */

  updateFlyoutTask: function B_updateFlyoutTask() {
    let isStarred = yield Browser.isSiteStarred();
    let tab = Browser.selectedTab;
    let snippets = tab.snippets;

    this._preview.label = Browser.selectedBrowser.contentTitle;
    this._preview.url = Browser.selectedBrowser.currentURI;
    View.prototype._gotIcon(this._preview, tab.browser.mIconURL);

    this._deleteButton.hidden = !isStarred;
    this._saveButton.label = isStarred ? "Save Changes" : "Add Bookmark";
  },

  showFlyout: function B_showFlyout() {
    Task.spawn(this.updateFlyoutTask).
      then(() => this._flyout.openFlyout(this._starButton, "before_center"));
  },

  onNoThumbnailChange: function B_onNoThumbnailChange() {
    Task.spawn(this.updateFlyoutTask);
  },

  onSaveChangesButton: function B_onSaveChangesButton() {
    Browser.starSite().
      then(() => {
        this._flyout.hideFlyout();
        this._updateStarButton();
      });
  },

  onDeleteButton: function B_onDeleteButton () {
    Browser.unstarSite().
      then(() => {
        this._flyout.hideFlyout();
        this._updateStarButton();
      });
  },

  /*********************************
   * Star & Pin Buttons
   */

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

  handleEvent: function BC_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "URLChanged":
      case "TabSelect":
      case "MozAppbarShowing":
        this._updateStarButton();
        this._updatePinButton();
        break;
    }
  }
};