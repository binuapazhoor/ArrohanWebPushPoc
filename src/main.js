"use strict";

// normally we would group the imports together, have kept them separate
// to hopefally make it clear which dependencies are being used where and for what

// =========== Amplify client lib Analytics init ============
// standard process for using aws pinpoint analytics on your website,
// nothing specific to web push here
// refer https://aws-amplify.github.io/docs/js/analytics#configure-your-app
//import Auth from "@aws-amplify/auth";
//import Analytics from "@aws-amplify/analytics";

import amplifyconfig from './amplifyconfiguration.json';
import {Amplify} from 'aws-amplify';
import { identifyUser } from 'aws-amplify/analytics';

import { record, configureAutoTrack } from 'aws-amplify/analytics';

import Storage from '@aws-amplify/storage';

Amplify.configure(amplifyconfig);

// aws related config would be in a file automatically generated by AWS Amplify
// structure would be similar to the sample config file aws-exports-sample.js
import awsconfig from "./aws-exports";

//Auth.configure(awsconfig); // retrieve temporary AWS credentials and sign requests
//Analytics.configure(awsconfig); // send analytics events to Amazon Pinpoint

// disable auto tracking for now since we don't care about other events
// you can always enable it later,
// refer https://aws-amplify.github.io/docs/js/analytics#using-analytics-auto-tracking
//Analytics.autoTrack("session", {
//  enable: false
//});

// =========== Firebase client lib init ============
// standard init procedure for any firebase client module,
// in this case we are using firebase messaging (FCM)
// refer: https://firebase.google.com/docs/web/setup#add_firebase_to_your_app
//import Firebase from "@firebase/app";
import "@firebase/messaging";

// Firebase Config which would be there in firebase developer console for your project
// Replace the values here with the actual values for your project
// refer: https://firebase.google.com/docs/web/setup?authuser=0#add-sdks-initialize


// Import the functions you need from the SDKs you need
//import { initializeApp } from "firebase/app";
//import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {
  apiKey: "YOUR API KEY GOES HERE",
  projectId: "YOUR PROJECT ID GOES HERE",
  messagingSenderId: "YOUR SENDER GOES HERE",
  appId: "YOUR APP ID GOES HERE"
};

// Initialize Firebase
//const app = initializeApp(firebaseConfig);
//const analytics = getAnalytics(app);

import { initializeApp } from "firebase/app";
import { getMessaging,getToken, isSupported, useServiceWorker } from "firebase/messaging";

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/learn-more#config-object

// Initialize Firebase
const app = initializeApp(firebaseConfig);


// Initialize Firebase Cloud Messaging and get a reference to the service
const messaging = getMessaging(app);


// ServiceWorker: Amplify wrapper on browser Service worker apis,
// refer https://aws-amplify.github.io/docs/js/service-workers

import { ServiceWorker } from 'aws-amplify/utils';
var myServiceWorker = new ServiceWorker();

// A URL safe base64 encoded server application public vapid key.
// refer: https://developers.google.com/web/fundamentals/push-notifications/web-push-protocol#application_server_keys
var appPublicKey = "YOUR PUBLIC KEY GOES HERE";

// =========== Pinpoint: send FCM push token to pinpoint ============
/**
 * takes a fcm token as input and sends it to aws pinpoint backend
 * in pinpoint, every push token is treated as a unique endpoint
 * so we are using the updateEndpoint api, with channelType set as "GCM"
 * refer https://aws-amplify.github.io/docs/js/analytics#update-endpoint
 */

function sendTokenToPinpoint(fcmToken) {
  identifyUser({address:fcmToken, channelType: "GCM", optOut: "NONE"});
}

// =========== FCM: fetch an FCM token for web push subscription ============
/**
 * get an FCM token for a web push subscription
 * refer https://firebase.google.com/docs/cloud-messaging/js/client
 * Note that we do not need to pass the subscripton object since the Firebase library
 * will internally fetch it from the sw registration using push manager apis.
 * refer https://developer.mozilla.org/en-US/docs/Web/API/PushManager/getSubscription.
 * send the fetched fcm token to pinpoint.
 */

function getFCMToken() {
    navigator.serviceWorker.ready.then((registration) => {
    
    getToken(messaging, { vapidKey: appPublicKey, serviceWorkerRegistration: registration })
    .then(function(currentToken) {
      // update the UI
      editPushUI(
        true,
        "Push notifications are enabled",
        "fcm token: " + currentToken
      );
      sendTokenToPinpoint(currentToken); // send the FCM token to the pinpoint backend
    })
    .catch(function(err) {
      console.log("An error occurred while retrieving token. ", err);
      // A problem occurred in fetching the fcm token, allow users to try again
      editPushUI(
        false,
        "",
        "Unable to retrieve FCM token, please retry.\nError Message:" +
          err.message
      );
  
    })
  });
  
}

/**
 * The onTokenRefreshcallback fires whenever a new token is generated,
 * so calling getToken in its context ensures that you are accessing a current, available registration token
 * refer: https://firebase.google.com/docs/cloud-messaging/js/client
 */
/*
messaging.onTokenRefresh(function() {
  messaging
    .getToken()
    .then(function(refreshedToken) {
      console.log("Token refreshed: ", refreshedToken);
      sendTokenToPinpoint(refreshedToken); // send the FCM token to the pinpoint backend
    })
    .catch(function(err) {
      console.log("Unable to retrieve refreshed token ", err);
      // A problem occurred in fetching the updated fcm token, better to ask users to subscribe again
      editPushUI(
        false,
        "",
        "Unable to retrieve FCM token, please retry.\nError Message" +
          err.message
      );
    });
});
*/
// =========== web push subscription ============
/**
 * subscribe for web push and use the subscription to get an FCM token
 * to generate a web push subcription, using the Amplify enablePush api.
 * refer: https://aws-amplify.github.io/docs/js/service-workers#working-with-the-api
 */
function subscribe() {
  // Disable the button so it can't be changed while we process the subscribe request
  subscribeButton.disabled = true;

  // use the app public key to created a restricted push subscription so that "others"
  // are not able to send push messages to our users even if they get the subscription info.
  // this is the essence of the web push protocol vapid spec
  // refer: https://tools.ietf.org/html/draft-thomson-webpush-vapid-02#section-5 .
  myServiceWorker
    .enablePush(appPublicKey)
    .then(function(subscription) {
      // subscription was successful, get a FCM token for the web push subscription
      getFCMToken();
    })
    .catch(function(e) {
      if (Notification.permission === "denied") {
        editPushUI(
          true,
          "Push Notifications are disabled",
          "You denied the notification permission which means we failed to subscribe,\
please manually change the notification permission to 'default' or 'granted' in browser settings \
to subscribe to push messages." // have to break indentation here else whitespace will be shown
        );
      } else {
        console.log("Unable to subscribe to push.", e);
        // A problem occurred with the subscription, allow users to try again
        editPushUI(
          false,
          "",
          "Unable to generate push subscription, please retry.\nError Message : " +
            e.message
        );
      }
    });
}

// =========== UI: Update Page UI to reflect current permission and subscription state ============
/**
 * This is some very elementary UI to keep this prototype code short and
 * focussed on the functional aspects of web push.
 * in reality you would have a beautiful web site and would clearly tell the user
 * about their current push subscription status.
 */

var subscribeButton = undefined; // button to subcribe for push
var logContainer = undefined; // to show the fcm token and other error messages etc, useful for debugging

/**
 * Used to set/modify the push UI i.e. the subscribe button and the message container.
 * Input params:
 * subscribeButtonDisabled: Boolean to set whether the subscribe button should be disabled.
 * subscribeButtonText (Optional) : Text to show on the subscribe Button, 
   existing content will not be modified if input is falsy.
 * logMessage: Text to show on the log message container.
 */
function editPushUI(subscribeButtonDisabled, subscribeButtonText, logMessage) {
  subscribeButton.disabled = subscribeButtonDisabled;
  if (subscribeButtonText) {
    subscribeButton.textContent = subscribeButtonText;
  }
  logContainer.textContent = logMessage;
}

// =========== Init ============
/**
 * Performs some init steps for using web push, they are
 * 1. Check if the browser supports web push, using isSupported() method provided by firebase client lib,
 *    refer: https://firebase.google.com/docs/reference/js/firebase.messaging#.isSupported .
 * 2. Register the service worker.
 * 3. Gracefully handle cases where the initial permission state is not default.
 */
function initializeState() {
  // check if the browser supports web push else exit early
  if (!isSupported()) {
    editPushUI(
      true,
      "",
      "This browser currently does not support push notifications, \
please try on a different browser.\n\
refer https://caniuse.com/#search=push-api to get current browser support matrix."
    );
    return;
  }

  // register service worker
  myServiceWorker.register("/service-worker.js", "/").then(registration => {
    // needed when we are using our custom service worker implementation with firebase messaging
    // also firebase uses the sw registration to fetch the current push subscription during getToken()
    //messaging.useServiceWorker(registration);

    // Check the current Notification permission.
    // If its denied, it's a permanent block until the user changes the permission
    var currentPermission = Notification.permission;
    if (currentPermission === "denied") {
      editPushUI(
        true,
        "Push Notifications are disabled",
        "please manually change the notification permission to 'default' or 'granted' in \
browser settings to subscribe to push messages."
      );
    }

    // we need to pass the app public key since FCM servers do not issue a token
    // if you do not pass the public key, perhaps due to security reasons/
    // similar example: https://developers.google.com/instance-id/reference/server#import_push_subscriptions
    //messaging.usePublicVapidKey(appPublicKey);
    if (currentPermission === "granted") {
      subscribe(); // permissions are already granted, subscribe
    }
  });
}

/**
 * Inititalize the ui elements
 * set the click listener on the subscribe button
 */
function initUI() {
  subscribeButton = document.getElementById("subscribe-button");
  logContainer = document.getElementById("log-container");

  // add click listener to the subscribe button
  subscribeButton.addEventListener("click", function() {
    subscribe();
  });
}

/**
 * On Page Load call init
 */
document.addEventListener("DOMContentLoaded", function() {
  initUI();
  initializeState();
});
