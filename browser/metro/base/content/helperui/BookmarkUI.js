/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var BookmarkUI = {
  get _flyout() { return document.getElementById("bookmarkcreator"); },
  get _flyoutPreview () { return document.getElementById("bookmarkcreator-preview"); },
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

  showFlyout: function B_showFlyout() {
    let snippets = Browser.selectedTab.snippets;

    this._flyoutPreview.label = Browser.selectedBrowser.contentTitle;
    this._flyoutPreview.url = Browser.selectedBrowser.currentURI;

    this._flyout.openFlyout(this._starButton, "before_center");
  },

  onSaveChangesButton: function BC_onSaveChangesButton() {
    Browser.starSite().
      then(() => {
        this._updateStarButton()
        this._flyout.hide();
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