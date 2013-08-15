// -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; js2-basic-offset: 2; js2-skip-preprocessor-directives: t; -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

let HighlightsUI = {
  __menuPopup: null,

  get _panel() { return document.getElementById("highlights-container"); },
  get _popup() { return document.getElementById("highlights-popup"); },
  get _button() { return document.getElementById(""); },

  get _menuPopup() {
    if (!this.__menuPopup) {
      this.__menuPopup = new MenuPopup(this._panel, this._popup);
      this.__menuPopup.controller = this;
    }
    return this.__menuPopup;
  },

  show: function HUI_show() {
    this._menuPopup.show();
  },

  onStarButton: function HUI_onStarButton() {
    this.show();
  }
};

