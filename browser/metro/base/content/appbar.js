/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var Appbar = {
  get menuButton()    { return document.getElementById('menu-button'); },

  // track selected/active richgrid/tilegroup - the context for contextual action buttons
  activeTileset: null,

  init: function Appbar_init() {
    // fired from appbar bindings
    Elements.contextappbar.addEventListener('MozAppbarDismissing', this, false);

    // fired when a context sensitive item (bookmarks) changes state
    window.addEventListener('MozContextActionsChange', this, false);

    // tilegroup selection events for all modules get bubbled up
    window.addEventListener("selectionchange", this, false);
  },

  handleEvent: function Appbar_handleEvent(aEvent) {
    switch (aEvent.type) {
      case 'MozAppbarDismissing':
        if (this.activeTileset && ('isBound' in this.activeTileset)) {
          this.activeTileset.clearSelection();
        }
        this.clearContextualActions();
        this.activeTileset = null;
        break;

      case 'MozContextActionsChange':
        let actions = aEvent.actions;
        let setName = aEvent.target.contextSetName;
        // could transition in old, new buttons?
        this.showContextualActions(actions, setName);
        break;

      case "selectionchange":
        let nodeName = aEvent.target.nodeName;
        if ('richgrid' === nodeName) {
          this._onTileSelectionChanged(aEvent);
        }
        break;
    }
  },

  onDownloadButton: function() {
    // TODO: Bug 883962: Toggle the downloads infobar when the
    // download button is clicked
    ContextUI.dismiss();
  },

  onMenuButton: function(aEvent) {
    let menu = document.getElementById("extras");
    menu.openFlyout(this.menuButton, "before_end");
  },

  onAutocompleteCloseButton: function () {
    Elements.autocomplete.closePopup();
  },

  dispatchContextualAction: function(aActionName){
    let activeTileset = this.activeTileset;
    if (activeTileset && ('isBound' in this.activeTileset)) {
      // fire event on the richgrid, others can listen
      // but we keep coupling loose so grid doesn't need to know about appbar
      let event = document.createEvent("Events");
      event.action = aActionName;
      event.initEvent("context-action", true, true); // is cancelable
      activeTileset.dispatchEvent(event);
      if (!event.defaultPrevented) {
        activeTileset.clearSelection();
        Elements.contextappbar.dismiss();
      }
    }
  },

  showContextualActions: function(aVerbs, aSetName) {
    // When the appbar is not visible, we want the icons to refresh right away
    let immediate = !Elements.contextappbar.isShowing;

    if (aVerbs.length) {
      Elements.contextappbar.show();
    } else {
      Elements.contextappbar.hide();
    }

    // Look up all of the buttons for the verbs that should be visible.
    let idsToVisibleVerbs = new Map();
    for (let verb of aVerbs) {
      let id = verb + "-selected-button";
      if (!document.getElementById(id)) {
        throw new Error("Appbar.showContextualActions: no button for " + verb);
      }
      idsToVisibleVerbs.set(id, verb);
    }

    // Sort buttons into 2 buckets - needing showing and needing hiding.
    let toHide = [], toShow = [];
    let buttons = Elements.contextappbar.getElementsByTagName("toolbarbutton");
    for (let button of buttons) {
      let verb = idsToVisibleVerbs.get(button.id);
      if (verb != undefined) {
        // Button should be visible, and may or may not be showing.
        this._updateContextualActionLabel(button, verb, aSetName);
        if (button.hidden) {
          toShow.push(button);
        }
      } else if (!button.hidden) {
        // Button is visible, but shouldn't be.
        toHide.push(button);
      }
    }

    if (immediate) {
      toShow.forEach(function(element) {
        element.removeAttribute("fade");
        element.hidden = false;
      });
      toHide.forEach(function(element) {
        element.setAttribute("fade", true);
        element.hidden = true;
      });
      return;
    }

    return Task.spawn(function() {
      if (toHide.length) {
        yield Util.transitionElementVisibility(toHide, false);
      }
      if (toShow.length) {
        yield Util.transitionElementVisibility(toShow, true);
      }
    });
  },

  clearContextualActions: function() {
    this.showContextualActions([]);
  },

  _updateContextualActionLabel: function(aButton, aVerb, aSetName) {
    // True if the action's label string contains the set name and
    // thus has to be selected based on the list passed in.
    let usesSetName = aButton.hasAttribute("label-uses-set-name");
    let name = "contextAppbar2." + aVerb + (usesSetName ? "." + aSetName : "");
    aButton.label = Strings.browser.GetStringFromName(name);
  },

  _onTileSelectionChanged: function _onTileSelectionChanged(aEvent){
    let activeTileset = aEvent.target;

    // deselect tiles in other tile groups,
    // ensure previousyl-activeTileset is bound before calling methods on it
    if (this.activeTileset &&
          ('isBound' in this.activeTileset) &&
          this.activeTileset !== activeTileset) {
      this.activeTileset.clearSelection();
    }
    // keep track of which view is the target/scope for the contextual actions
    this.activeTileset = activeTileset;

    // ask the view for the list verbs/action-names it thinks are
    // appropriate for the tiles selected
    let contextActions = activeTileset.contextActions;
    let verbs = [v for (v of contextActions)];

    // fire event with these verbs as payload
    let event = document.createEvent("Events");
    event.actions = verbs;
    event.initEvent("MozContextActionsChange", true, false);
    activeTileset.dispatchEvent(event);

    if (verbs.length) {
      Elements.contextappbar.show(); // should be no-op if we're already showing
    } else {
      Elements.contextappbar.dismiss();
    }
  }
};
