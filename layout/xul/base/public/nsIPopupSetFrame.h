/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla Communicator client code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#ifndef nsIPopupSetFrame_h___
#define nsIPopupSetFrame_h___

// 043ecc8e-469f-40e1-9569-0529ac0c3039
#define NS_IPOPUPSETFRAME_IID \
{ 0x043ecc8e, 0x469f, 0x40e1, \
 { 0x95, 0x69, 0x05, 0x29, 0xac, 0x0c, 0x30, 0x39 } }

class nsIFrame;
class nsIContent;
class nsIDOMElement;

#include "nsString.h"

class nsIPopupSetFrame : public nsISupports {

public:
  NS_DECLARE_STATIC_IID_ACCESSOR(NS_IPOPUPSETFRAME_IID)

  NS_IMETHOD ShowPopup(nsIContent* aElementContent, nsIContent* aPopupContent, 
                       PRInt32 aXPos, PRInt32 aYPos, 
                       const nsString& aPopupType, const nsString& anAnchorAlignment,
                       const nsString& aPopupAlignment) = 0;
  NS_IMETHOD HidePopup(nsIFrame* aPopup) = 0;
  NS_IMETHOD DestroyPopup(nsIFrame* aPopup, PRBool aDestroyEntireChain) = 0;
};

NS_DEFINE_STATIC_IID_ACCESSOR(nsIPopupSetFrame, NS_IPOPUPSETFRAME_IID)

#endif

