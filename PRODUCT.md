# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

SimplEOS is a desktop wallet for Antelope chains, built with Angular inside Tauri. Users manage accounts, transfer tokens, manage resources and permissions, and perform producer operations through reviewed transactions.

## Capabilities and Constraints

The bridge integration starts with Ultra to Ethereum and should accommodate other bridges through adapters. The user selected native Ultra signing and transfer tracking in SimplEOS, with Ethereum claims and reverse transfers signed in Ultra's official bridge. Preserve the existing account selection, trusted transaction confirmation, and wallet key handling.

## Operating Context

This is an extension of the existing dashboard. Keep the established app theme, navigation, and desktop layout. Bridge limits and token mappings must reflect live contracts. A submitted source-chain transaction is not a completed cross-chain transfer.

## Evidence on Hand

Existing app routes and transaction services, user screenshots of the Ultra bridge, official contract research under docs/reviews, and read-only bridge fixtures under tests/fixtures/ultra-bridge.
