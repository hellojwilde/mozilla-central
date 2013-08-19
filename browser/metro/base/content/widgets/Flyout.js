/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Positioning buffer enforced between the edge of a context menu
// and the edge of the screen.
const kPositionPadding = 10;

/**
 * Wraps DOM to create an interactive popup menu.
 *
 * @param {Element} aPanel  An outer panel element (a XUL box).
 * @param {Element} aPopup  The inner popup container element (also a XUL box).
 */

function Flyout(aPanel, aPopup) {
  this._panel = aPanel;
  this._popup = aPopup;
  this._wantTypeBehind = false;

  window.addEventListener('MozAppbarShowing', this, false);
}

Flyout.prototype = {
  _currentPositionOptions: {},

  get visible() { return !this._panel.hidden; },
  get commands() { return this._popup.childNodes[0]; },

  show: function (aPositionOptions) {
    if (this.visible) {
      return this._animateHide()
                 .then(() => this._animateShow(aPositionOptions));
    }

    return this._animateShow(aPositionOptions);
  },

  hide: function () {
    if (!this.visible) {
      return Promise.defer().reject("already visible");
    }

    return this._animateHide();
  },

  realign: function () {
    // XXX we have to run this twice. first time sets size properly.
    // second time sets the position given the new size
    this._position(this._currentPositionOptions);
    this._position(this._currentPositionOptions);
  },

  _position: function _position(aPositionOptions) {
    let aX = aPositionOptions.xPos;
    let aY = aPositionOptions.yPos;
    let aSource = aPositionOptions.source;

    // Set these first so they are set when we do misc. calculations below.
    if (aPositionOptions.maxWidth) {
      this._popup.style.maxWidth = aPositionOptions.maxWidth + "px";
    }
    if (aPositionOptions.maxHeight) {
      this._popup.style.maxHeight = aPositionOptions.maxHeight + "px";
    }

    let width = this._popup.boxObject.width;
    let height = this._popup.boxObject.height;
    let halfWidth = width / 2;
    let screenWidth = ContentAreaObserver.width;
    let screenHeight = ContentAreaObserver.height;

    // Add padding on the side of the menu per the user's hand preference
    let leftHand = MetroUtils.handPreference == MetroUtils.handPreferenceLeft;
    if (aSource && aSource == Ci.nsIDOMMouseEvent.MOZ_SOURCE_TOUCH) {
      this.commands.setAttribute("left-hand", leftHand);
    }

    if (aPositionOptions.rightAligned)
      aX -= width;

    if (aPositionOptions.bottomAligned)
      aY -= height;

    if (aPositionOptions.centerHorizontally)
      aX -= halfWidth;

    // Always leave some padding.
    if (aX < kPositionPadding) {
      aX = kPositionPadding;
    } else if (aX + width + kPositionPadding > screenWidth){
      // Don't let the popup overflow to the right.
      aX = Math.max(screenWidth - width - kPositionPadding, kPositionPadding);
    }

    if (aY < kPositionPadding  && aPositionOptions.moveBelowToFit) {
      // show context menu below when it doesn't fit.
      aY = aPositionOptions.yPos;
    }

    if (aY < kPositionPadding) {
      aY = kPositionPadding;
    } else if (aY + height + kPositionPadding > screenHeight){
      aY = Math.max(screenHeight - height - kPositionPadding, kPositionPadding);
    }

    this._panel.left = aX;
    this._panel.top = aY;

    if (!aPositionOptions.maxHeight) {
      // Make sure it fits in the window.
      let popupHeight = Math.min(aY + height + kPositionPadding, screenHeight - aY - kPositionPadding);
      this._popup.style.maxHeight = popupHeight + "px";
    }

    if (!aPositionOptions.maxWidth) {
      let popupWidth = Math.min(aX + width + kPositionPadding, screenWidth - aX - kPositionPadding);
      this._popup.style.maxWidth = popupWidth + "px";
    }
  },

  _animateShow: function (aPositionOptions) {
    let deferred = Promise.defer();

    window.addEventListener("keypress", this, true);
    window.addEventListener("click", this, true);
    Elements.stack.addEventListener("PopupChanged", this, false);
    Elements.browsers.addEventListener("PanBegin", this, false);

    this._panel.hidden = false;
    let popupFrom = !aPositionOptions.bottomAligned ? "above" : "below";
    this._panel.setAttribute("showingfrom", popupFrom);

    // This triggers a reflow, which sets transitionability.
    // All animation/transition setup must happen before here.
    this._currentPositionOptions = aPositionOptions || {};
    this._position(this._currentPositionOptions);

    let self = this;
    this._panel.addEventListener("transitionend", function popupshown () {
      self._panel.removeEventListener("transitionend", popupshown);
      self._panel.removeAttribute("showingfrom");

      self._dispatch("popupshown");
      deferred.resolve();
    });

    this._panel.setAttribute("showing", "true");
    return deferred.promise;
  },

  _animateHide: function () {
    let deferred = Promise.defer();

    window.removeEventListener("keypress", this, true);
    window.removeEventListener("click", this, true);
    Elements.stack.removeEventListener("PopupChanged", this, false);
    Elements.browsers.removeEventListener("PanBegin", this, false);

    let self = this;
    this._panel.addEventListener("transitionend", function popuphidden() {
      self._currentPositionOptions = {};
      self._panel.removeEventListener("transitionend", popuphidden);
      self._panel.removeAttribute("hiding");
      self._panel.hidden = true;
      self._popup.style.maxWidth = "none";
      self._popup.style.maxHeight = "none";

      self._dispatch("popuphidden");
      deferred.resolve();
    });

    this._panel.setAttribute("hiding", "true");
    this._panel.removeAttribute("showing");
    return deferred.promise;
  },

  _dispatch: function _dispatch(aName) {
    let event = document.createEvent("Events");
    event.initEvent(aName, true, false);
    this._panel.dispatchEvent(event);
  },

  handleEvent: function handleEvent(aEvent) {
    switch (aEvent.type) {
      case "keypress":
        if (!this._wantTypeBehind) {
          // Hide the context menu so you can't type behind it.
          aEvent.stopPropagation();
          aEvent.preventDefault();
          if (aEvent.keyCode != aEvent.DOM_VK_ESCAPE)
            this.hide();
        }
        break;
      case "click":
        if (!this._popup.contains(aEvent.target)) {
          aEvent.stopPropagation();
          this.hide();
        }
        break;
      case "PopupChanged":
        if (aEvent.detail) {
          this.hide();
        }
        break;
      case "MozAppbarShowing":
        if (this.controller && this.controller.hide) {
          this.controller.hide()
        } else {
          this.hide();
        }
        break;
      case "PanBegin":
        this.hide();
        break;
    }
  }
};

function PagedFlyout(aPanel, aPopup) {
  Flyout.call(this, aPanel, aPopup);
}

PagedFlyout.prototype = Util.extend(Object.create(Flyout.prototype), {
  _pages: {},
  _page: null,

  get page() { return this._page; },

  registerPage: function (aName, aController) {
    this._pages[aName] = aController;
  },

  displayPage: function (aName, aOptions) {
    if (!this._pages[aName]) {
      throw "PagedFlyout.displayPage: page " + aName + " does not exist."
    }

    this._page = aName;
    this._popup.setAttribute("page", this._page);

    let controller = this._pages[aName];
    if (controller.display) {
      controller.display(aOptions)
    }
  },

  resizePage: function () {
    let controller = this._pages[this._page];
    if (controller.resize) {
      controller.resize()
    }
  }
});

PagedFlyout.prototype.constructor = PagedFlyout;