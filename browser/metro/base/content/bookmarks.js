/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/**
 * Utility singleton for manipulating bookmarks.
 */
var Bookmarks = {
  get metroRoot() {
    return PlacesUtils.annotations.
      getItemsWithAnnotation('metro/bookmarksRoot', {})[0];
  },

  logging: false,
  log: function(msg) {
    if (this.logging) {
      Services.console.logStringMessage(msg);
    }
  },

  /**
   * Bookmarks a URI with an attached title.
   * @param   {nsIURI}  aURI    The page URI to bookmark.
   * @param   {String}  aTitle  The title to set with the URI as the bookmark.
   * @returns {Promise} Resolved with the id of the bookmark added or
   *                    rejected if there is already a bookmark for the URI.
   */
  addForURI: function bh_addForURI(aURI, aTitle) {
    return this.isURIBookmarked(aURI).
      then(function (isBookmarked) {
        let def = Promise.defer()
        if (!isBookmarked) {
          let title = aTitle || aURI.spec;
          let service = PlacesUtils.bookmarks;
          let id = service.insertBookmark(Bookmarks.metroRoot,
                                          aURI,
                                          service.DEFAULT_INDEX,
                                          title);
          def.resolve(id);
        } else {
          def.reject();
        }
        return def.promise;
      });
  },

  /**
   * Determines if a URI is bookmarked.
   * @param   {nsIURI}  aURI  The page URI to check.
   * @returns {Promise} Resolved with a bool that's true if the URI
   *                    is bookmarked and false otherwise.
   */
  isURIBookmarked: function bh_isURIBookmarked(aURI) {
    let def = Promise.defer();
    PlacesUtils.asyncGetBookmarkIds(aURI, function(aItemIds) {
      def.resolve(aItemIds && aItemIds.length > 0);
    });
    return def.promise;
  },

  /**
   * Gets the first bookmark ID for a URI.
   * @param   {nsIURI}  aURI  The page URI to check.
   * @returns {Promise} Resolved with the bookmark ID or
   *                    null if there is no bookmark for the URI.
   */
  getForURI: function bg_getForURI(aURI) {
    let def = Promise.defer();
    PlacesUtils.asyncGetBookmarkIds(aURI, function(aItemIds) {
      let haveItems = aItemIds && aItemIds.length > 0;
      def.resolve((haveItems) ? aItemIds[0] : null);
    });
    return def.promise;
  },

  /**
   * Removes all bookmark entries for the URI.
   * @param   {nsIURI}  aURI  The page URI to check
   * @returns {Promise} Resolved with an object with the URI and IDs removed.
   */
  removeForURI: function bh_removeForURI(aURI) {
    let def = Promise.defer();
    // XXX blargle xpconnect! might not matter, but a method on
    // nsINavBookmarksService that takes an array of items to
    // delete would be faster. better yet, a method that takes a URI
    PlacesUtils.asyncGetBookmarkIds(aURI, function(aItemIds) {
      aItemIds.forEach(PlacesUtils.bookmarks.removeItem);
      def.resolve({ uri: aURI, ids: aItemIds });
    });
    return def.promise;
  },

  getLists: function bh_getLists() {
    let history = PlacesUtils.history;

    let options = history.getNewQueryOptions();
    options.queryType = options.QUERY_TYPE_BOOKMARKS;
    options.excludeQueries = true; // Don't include "smart folders"
    options.excludeItems = true; // Don't include bookmarks

    let query = history.getNewQuery();
    query.setFolders([Bookmarks.metroRoot], 1);

    let result = history.executeQuery(query, options);
    let lists = [];
    let rootNode = result.root;
    rootNode.containerOpen = true;

    for (let i = 0, len = rootNode.childCount; i < len; i++) {
      let node = rootNode.getChild(i);
      lists.push({ id: node.itemId, title: node.title });
    }

    rootNode.containerOpen = false;
    return lists;
  },

  createList: function bh_createList(aTitle) {
    return 0;
  }
};