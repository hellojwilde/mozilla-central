/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * The contents of this file are subject to the Netscape Public License
 * Version 1.0 (the "NPL"); you may not use this file except in
 * compliance with the NPL.  You may obtain a copy of the NPL at
 * http://www.mozilla.org/NPL/
 *
 * Software distributed under the NPL is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the NPL
 * for the specific language governing rights and limitations under the
 * NPL.
 *
 * The Initial Developer of this code under the NPL is Netscape
 * Communications Corporation.  Portions created by Netscape are
 * Copyright (C) 1998 Netscape Communications Corporation.  All Rights
 * Reserved.
 */

#include "nsIOService.h"
#include "nsIProtocolHandler.h"
#include "nscore.h"
#include "nsString2.h"
#include "nsIServiceManager.h"
#include "nsIEventQueueService.h"
#include "nsIFileTransportService.h"
#include "nsIURI.h"
#include "nsIStreamListener.h"
#include "nsCOMPtr.h"
#include "prprf.h"
#include "prmem.h"      // for PR_Malloc
#include "prsystem.h"   // for PR_GetSystemInfo
#include "nsIFileProtocolHandler.h"     // for NewChannelFromNativePath
#include "nsLoadGroup.h"
#include "nsIFileChannel.h"
#include "nsInputStreamChannel.h"
#include "nsXPIDLString.h" 

static NS_DEFINE_CID(kFileTransportService, NS_FILETRANSPORTSERVICE_CID);
static NS_DEFINE_CID(kEventQueueService, NS_EVENTQUEUESERVICE_CID);


////////////////////////////////////////////////////////////////////////////////

nsIOService::nsIOService()
{
    NS_INIT_REFCNT();
}

nsresult
nsIOService::Init()
{

    // initialize the version and app components
    mAppName = new nsCString("Netscape");
    if (!mAppName) return NS_ERROR_OUT_OF_MEMORY;
    mAppCodeName = new nsCString("Mozilla");
    if (!mAppCodeName) return NS_ERROR_OUT_OF_MEMORY;
    mAppVersion = new nsCString();
    if (!mAppVersion) return NS_ERROR_OUT_OF_MEMORY;
    mAppLanguage = new nsCString("en-US");
    if (!mAppLanguage) return NS_ERROR_OUT_OF_MEMORY;

    char platformBuf[SYS_INFO_BUFFER_LENGTH];
    PRStatus status = PR_GetSystemInfo(PR_SI_SYSNAME, platformBuf, sizeof(char) * SYS_INFO_BUFFER_LENGTH);
    if (PR_FAILURE == status)
        return NS_ERROR_FAILURE;

    mAppPlatform = new nsCString(platformBuf);
    if (!mAppPlatform) return NS_ERROR_OUT_OF_MEMORY;

    return NS_OK;
}

nsIOService::~nsIOService()
{
    delete mAppName;
    delete mAppCodeName;
    delete mAppVersion;
    delete mAppLanguage;
    delete mAppPlatform;
}

NS_METHOD
nsIOService::Create(nsISupports *aOuter, REFNSIID aIID, void **aResult)
{
    nsresult rv;
    if (aOuter)
        return NS_ERROR_NO_AGGREGATION;

    nsIOService* _ios = new nsIOService();
    if (_ios == nsnull)
        return NS_ERROR_OUT_OF_MEMORY;
    NS_ADDREF(_ios);
    rv = _ios->Init();
    if (NS_FAILED(rv)) {
        delete _ios;
        return rv;
    }
    rv = _ios->QueryInterface(aIID, aResult);
    NS_RELEASE(_ios);
    return rv;
}

NS_IMPL_ISUPPORTS(nsIOService, NS_GET_IID(nsIIOService));

////////////////////////////////////////////////////////////////////////////////

#define MAX_SCHEME_LENGTH       64      // XXX big enough?

#define MAX_NET_PROGID_LENGTH   (MAX_SCHEME_LENGTH + NS_NETWORK_PROTOCOL_PROGID_PREFIX_LENGTH + 1)

NS_IMETHODIMP
nsIOService::GetProtocolHandler(const char* scheme, nsIProtocolHandler* *result)
{
    nsresult rv;

    NS_ASSERTION(NS_NETWORK_PROTOCOL_PROGID_PREFIX_LENGTH
                 == nsCRT::strlen(NS_NETWORK_PROTOCOL_PROGID_PREFIX),
                 "need to fix NS_NETWORK_PROTOCOL_PROGID_PREFIX_LENGTH");

    // XXX we may want to speed this up by introducing our own protocol 
    // scheme -> protocol handler mapping, avoiding the string manipulation
    // and service manager stuff

    char buf[MAX_NET_PROGID_LENGTH];
    nsCAutoString progID(NS_NETWORK_PROTOCOL_PROGID_PREFIX);
    progID += scheme;
    progID.ToCString(buf, MAX_NET_PROGID_LENGTH);

    NS_WITH_SERVICE(nsIProtocolHandler, handler, buf, &rv);
    if (NS_FAILED(rv)) 
        return NS_ERROR_UNKNOWN_PROTOCOL;

    *result = handler;
    NS_ADDREF(handler);
    return NS_OK;
}

static nsresult
GetScheme(const char* inURI, char* *scheme)
{
    // search for something up to a colon, and call it the scheme
    NS_ASSERTION(inURI, "null pointer");
    if (!inURI) return NS_ERROR_NULL_POINTER;
    char c;
    const char* URI = inURI;
    PRUint8 length = 0;
    // skip leading white space
    while (nsString::IsSpace(*URI))
        URI++;
    while ((c = *URI++) != '\0') {
        if (c == ':') {
            char* newScheme = (char *)PR_Malloc(length+1);
            if (newScheme == nsnull)
                return NS_ERROR_OUT_OF_MEMORY;

            nsCRT::memcpy(newScheme, inURI, length);
            newScheme[length] = '\0';
            *scheme = newScheme;
            return NS_OK;
        }
        else if (nsString::IsAlpha(c)) {
            length++;
        }
        else 
            break;
    }
    return NS_ERROR_MALFORMED_URI;
}

nsresult
nsIOService::NewURI(const char* aSpec, nsIURI* aBaseURI,
                    nsIURI* *result, nsIProtocolHandler* *hdlrResult)
{
    nsresult rv;
    nsIURI* base;
    char* scheme;
    rv = GetScheme(aSpec, &scheme);
    if (NS_SUCCEEDED(rv)) {
        // then aSpec is absolute
        // ignore aBaseURI in this case
        base = nsnull;
    }
    else {
        // then aSpec is relative
        if (aBaseURI == nsnull)
            return NS_ERROR_MALFORMED_URI;
        rv = aBaseURI->GetScheme(&scheme);
        if (NS_FAILED(rv)) return rv;
        base = aBaseURI;
    }
    
    nsCOMPtr<nsIProtocolHandler> handler;
    rv = GetProtocolHandler(scheme, getter_AddRefs(handler));
    nsCRT::free(scheme);
    if (NS_FAILED(rv)) return rv;

    if (hdlrResult) {
        *hdlrResult = handler;
        NS_ADDREF(*hdlrResult);
    }
    return handler->NewURI(aSpec, base, result);
}

NS_IMETHODIMP
nsIOService::NewURI(const char* aSpec, nsIURI* aBaseURI,
                    nsIURI* *result)
{
    return NewURI(aSpec, aBaseURI, result, nsnull);
}

NS_IMETHODIMP
nsIOService::NewChannelFromURI(const char* verb, nsIURI *aURI,
                               nsILoadGroup *aGroup,
                               nsIEventSinkGetter *eventSinkGetter,
                               nsIChannel **result)
{
    nsresult rv;

    nsXPIDLCString scheme;
    rv = aURI->GetScheme(getter_Copies(scheme));
    if (NS_FAILED(rv)) return rv;

    nsCOMPtr<nsIProtocolHandler> handler;
    rv = GetProtocolHandler((const char*)scheme, getter_AddRefs(handler));
    if (NS_FAILED(rv)) return rv;

    nsIChannel* channel;
    rv = handler->NewChannel(verb, aURI, aGroup, eventSinkGetter, &channel);
    if (NS_FAILED(rv)) return rv;

    *result = channel;
    return rv;
}

NS_IMETHODIMP
nsIOService::NewChannel(const char* verb, const char *aSpec,
                        nsIURI *aBaseURI,
                        nsILoadGroup *aGroup,
                        nsIEventSinkGetter *eventSinkGetter,
                        nsIChannel **result)
{
    nsresult rv;
    nsCOMPtr<nsIURI> uri;
    nsCOMPtr<nsIProtocolHandler> handler;
    rv = NewURI(aSpec, aBaseURI, getter_AddRefs(uri), getter_AddRefs(handler));
    if (NS_FAILED(rv)) return rv;
    rv = handler->NewChannel(verb, uri, aGroup, eventSinkGetter, result);
    return rv;
}

NS_IMETHODIMP
nsIOService::MakeAbsolute(const char *aSpec,
                          nsIURI *aBaseURI,
                          char **result)
{
    nsresult rv;
    NS_ASSERTION(aBaseURI, "It doesn't make sense to not supply a base URI");

    if (aSpec == nsnull)
        return aBaseURI->GetSpec(result);
    
    char* scheme;
    rv = GetScheme(aSpec, &scheme);
    if (NS_SUCCEEDED(rv)) {
        nsAllocator::Free(scheme);
        // if aSpec has a scheme, then it's already absolute
        *result = nsCRT::strdup(aSpec);
        return (*result == nsnull) ? NS_ERROR_OUT_OF_MEMORY : NS_OK;
    }

    // else ask the protocol handler for the base URI to deal with it
    rv = aBaseURI->GetScheme(&scheme);
    if (NS_FAILED(rv)) return rv;
    
    nsCOMPtr<nsIProtocolHandler> handler;
    rv = GetProtocolHandler(scheme, getter_AddRefs(handler));
    nsCRT::free(scheme);
    if (NS_FAILED(rv)) return rv;

    return handler->MakeAbsolute(aSpec, aBaseURI, result);
}

NS_IMETHODIMP
nsIOService::GetAppCodeName(PRUnichar* *aAppCodeName)
{
    *aAppCodeName = mAppCodeName->ToNewUnicode();
    return NS_OK;
}

NS_IMETHODIMP
nsIOService::GetAppVersion(PRUnichar* *aAppVersion)
{
    *aAppVersion = mAppVersion->ToNewUnicode();
    return NS_OK;
}

// This guy needs to be called each time one of it's comprising pieces changes.
nsresult
nsIOService::BuildAppVersion() {
    // build up the app version
    mAppVersion->Truncate();
    mAppVersion->Append("5.0 [");
    mAppVersion->Append(*mAppLanguage);
    mAppVersion->Append("] (");
    mAppVersion->Append(*mAppPlatform);
    mAppVersion->Append("; I)");
    return NS_OK;
}

NS_IMETHODIMP
nsIOService::GetAppName(PRUnichar* *aAppName)
{
    *aAppName = mAppName->ToNewUnicode();
    return NS_OK;
}

NS_IMETHODIMP
nsIOService::GetLanguage(PRUnichar* *aLanguage)
{
    *aLanguage = mAppLanguage->ToNewUnicode();
    return NS_OK;
}

NS_IMETHODIMP
nsIOService::SetLanguage(const PRUnichar* aLanguage)
{
    nsCString lang(aLanguage);
    mAppLanguage->SetString(lang);
    return BuildAppVersion();
}

NS_IMETHODIMP
nsIOService::GetPlatform(PRUnichar* *aPlatform)
{
    *aPlatform = mAppPlatform->ToNewUnicode();
    return NS_OK;
}

NS_IMETHODIMP
nsIOService::GetUserAgent(PRUnichar* *aUserAgent)
{
    char buf[200];
    PR_snprintf(buf, 200, "%.100s/%.90s", mAppCodeName->GetBuffer(), mAppVersion->GetBuffer());
    nsAutoString2 aUA(buf);
    *aUserAgent = aUA.ToNewUnicode();
    return NS_OK;
}

////////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsIOService::NewAsyncStreamObserver(nsIStreamObserver *receiver, nsIEventQueue *eventQueue,
                                    nsIStreamObserver **result)
{
    return NS_NewAsyncStreamObserver(result, eventQueue, receiver);
    
}

NS_IMETHODIMP
nsIOService::NewAsyncStreamListener(nsIStreamListener *receiver, nsIEventQueue *eventQueue,
                                    nsIStreamListener **result)
{
    return NS_NewAsyncStreamListener(result, eventQueue, receiver);

}

NS_IMETHODIMP
nsIOService::NewSyncStreamListener(nsIInputStream **inStream, 
                                   nsIBufferOutputStream **outStream,
                                   nsIStreamListener **listener)
{
    return NS_NewSyncStreamListener(inStream, outStream, listener);

}

NS_IMETHODIMP
nsIOService::NewChannelFromNativePath(const char *nativePath, nsIFileChannel **result)
{
    nsresult rv;
    nsCOMPtr<nsIProtocolHandler> handler;
    rv = GetProtocolHandler("file", getter_AddRefs(handler));
    if (NS_FAILED(rv)) return rv;

    nsCOMPtr<nsIFileProtocolHandler> fileHandler = do_QueryInterface(handler, &rv);
    if (NS_FAILED(rv)) return rv;
    
    nsCOMPtr<nsIFileChannel> channel;
    rv = fileHandler->NewChannelFromNativePath(nativePath, getter_AddRefs(channel));
    if (NS_FAILED(rv)) return rv;
    
    *result = channel;
    return NS_OK;
}

NS_IMETHODIMP
nsIOService::NewLoadGroup(nsISupports* outer, nsIStreamObserver* observer,
                          nsILoadGroup* parent, nsILoadGroup **result)
{
    nsresult rv;
    nsILoadGroup* group;
    rv = nsLoadGroup::Create(outer, NS_GET_IID(nsILoadGroup), 
                             (void**)&group);
    if (NS_FAILED(rv)) return rv;

    rv = group->Init(observer, parent);
    if (NS_FAILED(rv)) {
        NS_RELEASE(group);
        return rv;
    }

    *result = group;
    return NS_OK;
}

NS_IMETHODIMP
nsIOService::NewInputStreamChannel(nsIURI* uri, const char *contentType, 
                                   PRInt32 contentLength,
                                   nsIInputStream *inStr, nsILoadGroup* group,
                                   nsIChannel **result)
{
    nsresult rv;
    nsInputStreamChannel* channel;
    rv = nsInputStreamChannel::Create(nsnull, NS_GET_IID(nsIChannel),
                                      (void**)&channel);
    if (NS_FAILED(rv)) return rv;
    rv = channel->Init(uri, contentType, contentLength, inStr, group);
    if (NS_FAILED(rv)) {
        NS_RELEASE(channel);
        return rv;
    }
    *result = channel;
    return NS_OK;
}
#if 0
NS_IMETHODIMP
nsIOService::GetSocketErrorString(PRUint32 iCode, PRUnichar** oString)
{
    nsresult rv = NS_ERROR_FAILURE;
    if (!oString)
        return NS_ERROR_NULL_POINTER;

    *oString = nsnull;

    switch (iCode) /* these are currently just nsSocketState 
                      (as in nsSocketTransport.h) */
    {
        case eSocketState_WaitDNS:
            {
                static nsAutoString mesg("Resolving host ");
                *oString = mesg.ToNewUnicode();
                if (!*oString) return NS_ERROR_OUT_OF_MEMORY;
                rv = NS_OK;
            }
            break;
        case eSocketState_Connected:
            {
                static nsAutoString mesg("Connected to ");
                *oString = mesg.ToNewUnicode();
                if (!*oString) return NS_ERROR_OUT_OF_MEMORY;
                rv = NS_OK;
            }
            break;
        case eSocketState_WaitReadWrite:
            {
                static nsAutoString mesg("Transfering data from ");
                *oString = mesg.ToNewUnicode();
                if (!*oString) return NS_ERROR_OUT_OF_MEMORY;
                rv = NS_OK;
            }
            break;
        case eSocketState_WaitConnect:
            {
                static nsAutoString mesg("Connecting to ");
                *oString = mesg.ToNewUnicode();
                if (!*oString) return NS_ERROR_OUT_OF_MEMORY;
                rv = NS_OK;
            }
            break;
        case eSocketState_Created: 
        case eSocketState_Closed:
        case eSocketState_Done:
        case eSocketState_Timeout:
        case eSocketState_Error:
        case eSocketState_Max:
        default:
            return rv; // just return error, ie no status strings for this case
            break;
    }
    return rv;
}
#endif

////////////////////////////////////////////////////////////////////////////////
