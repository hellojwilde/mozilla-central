/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var BookmarkCreatorUI = {
  get _flyout() { return document.getElementById("bookmarkcreator"); },
  get _flyoutPreview () { return document.getElementById("bookmarkcreator-preview"); },
  get _pinButton() { return document.getElementById("pin-button"); },
  get _starButton() { return document.getElementById("star-button"); },

  init: function BC_init() {
    // Events that signal that we need to update the star and pin buttons
    Elements.browsers.addEventListener('URLChanged', this, true);
    Elements.tabList.addEventListener('TabSelect', this, true);
    Elements.navbar.addEventListener('MozAppbarShowing', this, false);

    // Event that signals that there may have been a user cancellation
    this._flyout.addEventListener('flyouthiding', this, false);
  },

  /* Star and pin toolbar buttons */

  _updatePinButton: function() {
    this._pinButton.checked = Browser.isSitePinned();
  },

  onPinButton: function BC_onPinButton() {
    if (this._pinButton.checked) {
      this.show();
    } else {
      Browser.unpinSite();
    }
  },

  _updateStarButton: function BP__updateStarButton() {
    Browser.isSiteStarredAsync(function (isStarred) {
      this._starButton.checked = isStarred;
    }.bind(this));
  },

  onStarButton: function BC_onStarButton() {
    if (this._starButton.checked) {
      this.show();
    } else {
      Browser.unstarSite(() => BookmarkCreatorUI._updateStarButton());
    }
  },

  /* Flyout for creating a bookmark */

  show: function BC_show() {
    this._flyoutPreview.label = Browser.selectedBrowser.contentTitle;
    this._flyoutPreview.url = Browser.selectedBrowser.currentURI

    this._flyout.openFlyout(this._starButton, "before_center");
  },

  onSaveChangesButton: function BC_onSaveChangesButton() {
    Browser.starSite(() => BookmarkCreatorUI._updateStarButton());
    this._flyout.hide();
  },

  /* Event handling */

  handleEvent: function BC_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "URLChanged":
      case "TabSelect":
      case "MozAppbarShowing":
        this._updateStarButton();
        this._updatePinButton();
        break;
      case "flyouthiding":
        break;
    }
  }
};