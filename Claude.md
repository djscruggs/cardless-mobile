# Claude.md

**Project Overview:**

This is a mobile app contains a lightweight decentralized identity credential issued from cardlessid.org through a QR code. The purpose of the credential is for adult websites to verify that the user is old enough to view explicit content int their jurisdiction.

**Project Goals:**

The goal is to use a third party tool still TBD to verify someone’s identity on cardlessid.org, then write the credentials to a custom wallet in this app for the Algorand blockchain. The wallet will only be used to verify credentials to sites that request them. They will do so with QR code which asks if they were born before a certain date (configurable), and the wallet merely replies true or false along with the wallet address.

To maximize privacy, zero information about the user is stored in a database except as necessary to prevent DOS attacks on cardlessid.org and provide sybil resistance.

**Technology Stack**

The app is built in React Native.

**File Structure**

Build tools and configuration are in the project root

The app source code root is /src

**Important Notes**
This project is based on https://starter.obytes.com and uses an Expo custom dev client to support native dependencies, The Expo Go app **is not** an option to consider here. Instead, the app has to be installed on the simulator or device to start using it.

Adhere to Android’s specific naming conventions as described in the Android documentation. The name must satisfy the following rules:

It must have at least two segments (one or more dots).
Each segment must start with a letter.
All characters must be alphanumeric or an underscore [a-zA-Z0-9_].

Uupdating the app icon and splash screen is straightforward. You only need to update the app icon and splash screen images inside the assets folder and run expo prebuild to update the app icon and splash screen.

As we are supporting multiple variants for development, staging and production environments you need 3 different icons but the right solution is to use the same icon with badges for each environment.

**Running the App**
On iOS simulator: pnpm ios

On Android simulator: pnpm android

To install dependencies, run: npm install

To launch the app for development, run : npm run dev
