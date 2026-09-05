# Chargy WebApp

[![CI](https://github.com/OpenChargingCloud/ChargyWebApp/actions/workflows/ci.yml/badge.svg)](https://github.com/OpenChargingCloud/ChargyWebApp/actions/workflows/ci.yml)
[![Nightly](https://github.com/OpenChargingCloud/ChargyWebApp/actions/workflows/nightly.yml/badge.svg)](https://github.com/OpenChargingCloud/ChargyWebApp/actions/workflows/nightly.yml)

Chargy is a transparency software library for the validation of secure and transparent e-mobility charging processes, as defined by the *German Calibration Law ("Eichrecht")* in combination with the [Alternative Fuels Infrastructure Regulation (AFIR)](https://transport.ec.europa.eu/transport-themes/clean-transport/alternative-fuels-sustainable-mobility-europe/alternative-fuels-infrastructure_en) and the new [Measuring instruments (MID-11)](https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/measuring-instruments-mid_en) of the European Commission and the [European Digital Quality Infrastructure](https://www.qi-digital.de/en/). The software allows you to verify the cryptographic signatures of energy measurements within charge detail records and comes with a couple of useful extentions to simplify the entire process for endusers and operators.

<kbd>
  <img src="documentation/Screenshot02.png" alt="Screenshot" />
</kbd>

You can test the Chargy WebApp at: [https://chargy.charging.cloud](https://chargy.charging.cloud)


## Benefits of Chargy

1. Chargy comes with __*meta data*__. True charging transparency is more than just signed smart meter values. Chargy allows you to group multiple signed smart meter values to entire charging sessions and to add additional meta data like EVSE information, geo coordinates, tariffs, ... within your backend in order to improve the user experience for the ev drivers.
2. Chargy is __*secure*__. Chargy implements a public key infrastructure for managing certificates of smart meters, EVSEs, charging stations, charging station operators and e-mobility providers. By this the ev driver will always retrieve the correct public key to verify a charging process automatically and without complicated manual lookups in external databases.
3. Chargy is __*Open Source*__. In contrast to other vendors in e-mobility, we belief that true transparency is only trustworthy if the entire process and the required software is open and reusable under a fair copyleft license (AGPL).
4. Chargy is __*open for your contributions*__. We currently support adapters for the protocols of different charging station vendors like chargeIT mobility, ABL (OCMF), chargepoint. The certification at the Physikalisch-Technische Bundesanstalt (PTB) is provided by chargeIT mobility. If you want to add your protocol or a protocol adapter feel free to read the contributor license agreement and to send us a pull request.
5. Chargy is __*white label*__. If you are a supporter of the Chargy project you can even use the entire software project under the free Apache 2.0 license. This allows you to create proprietary forks implementing your own corporate design or to include Chargy as a library within your existing application (This limitation was introduced to avoid discussions with too many black sheeps in the e-mobility market. We are sorry...).
6. Chargy is __*accessible*__. For public sector bodies Chargy fully supports the [EU directive 2016/2102](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32016L2102) on the accessibility of websites and mobile applications and provides a context-sensitive feedback-mechanism and methods for dispute resolution.


## Supported Charge Transparency Data Formats

Currently supported formats include:

- **Alfen** charge transparency data
- **Bauer** energy meter data (2 format variants)
- **ChargePoint** transparency data (2 format variants)
- **EDL40** and **ISA-EDL40 SML** data
- **EMH** energy meter data
- **Mennekes** XML
- **OCMF**, versions v1.1 to v1.4
  - Bonner Eichrechtstage **Tariff Text** Extensions
  - EdDSA support: Ed25519 and Ed448
  - Post-Quantum Cryptography support: ML-DSA-44, ML-DSA-65, ML-DSA-87
- **Porsche Charging Data Format (PCDF)**

Supported representations include:

- **Plain Files** containing a single charge transparency data set.
- **chargeIT Container Format**, a JSON-based container format for a single charging session (2 format variants).
- **Chargy Container Format**, a JSON-based container format for multiple charging sessions.
- **SAFE XML Container Format**, an XML-based container format for a single charging session, optionally enriched with additional Chargy metadata about the charging session.
- **PTB Container Format**, a JSON-based container format for a single charging session.
- **Archive formats** such as ***tar, ZIP, tar.gz***, and similar formats that combine or compress multiple charge transparency files.
- **QR-Code images**, such as ***PNG, JPG, JPEG or SVG files***, where the QR-Code represents a charge transparency data set.
- **PDF/A-3** files transporting a charge transparency file as an embedded additional data stream.
- **Charge Transparency Live Links**, a JSON-LD document describing a charging session that is still **running**: where its live data can be fetched, the public keys to verify it with, and the signed meter values measured so far. See [Charge Transparency Live Links](#charge-transparency-live-links) below.


## Sample transparency records

The `documentation/` folder carries example records for most of the formats above. They are meant to be **tried by hand**: load them from the start screen, drag them onto the window, or paste their content.

| Folder | Contents |
|--------|----------|
| [`documentation/Alfen`](documentation/Alfen) | SAFE XML containers, including two that are supposed to **fail** verification, and the same session in the old and the new chargeIT container |
| [`documentation/ChargePoint`](documentation/ChargePoint) | ChargePoint records with their public keys, as `.chargy`, `.pem` and the raw signed payload |
| [`documentation/chargeIT`](documentation/chargeIT) | chargeIT containers in both format variants, the BSM/WS36A records — several of them **deliberately forged**, one value at a time — and the same data packed as `zip`, `tar`, `tar.gz` and `tgz` |
| [`documentation/GraphDefined`](documentation/GraphDefined) | A single session and a collection of sessions |
| [`documentation/XML`](documentation/XML) | An XML charge transparency container |

The forged and failing records are the interesting ones: a transparency software that accepts them is broken, so they are the quickest way to see that verification actually verifies.

These files are for manual use. The automated test suite has its own fixtures under `tests/fixtures/`.


## Editions, Versions and Milestones

Version 1.2.x of the Chargy Transparency Software (Desktop) was reviewed and certified by [Verband der Elektrotechnik Elektronik Informationstechnik e.V. (VDE)](https://www.vde.com/de). If you are a charge point vendor and want to use this software to verify the compliance with the German Eichrecht you can talk to our partner [ChargePoint](https://www.chargepoint.com/de-de/) and obtain the required legal documents.

Version 1.0.x of the Chargy Transparency Software (Desktop) was reviewed and certified by [Physikalisch-Technische Bundesanstalt (PTB)](https://www.ptb.de). If you are a charge point vendor and want to use this software to verify the compliance with the German Eichrecht you can talk to our partner [chargeIT mobility](https://www.chargeit-mobility.com) and obtain the required legal documents.

If you need help with the Chargy Transparency Software or want to include your smarty energy meter or transparency data format, talk to [us](https://open.charging.cloud).

This software is also available as [DesktopApp](https://github.com/OpenChargingCloud/ChargyDesktopApp).


## Installation

Assuming you have Node.js 22.13 or newer installed, you can clone this repository, install all JavaScript dependencies, compile it and run the webpack development server...

```
git clone https://github.com/OpenChargingCloud/ChargyWebApp.git
cd ChargyWebApp
npm install
npm run build
npm start
```

Your prefered web browser should automagically open http://localhost:1608

For Linux production deployments, build the static web application and serve the generated `build/` directory with a web server such as nginx. See [Chargy WebApp on Linux](documentation/LinuxService.md).

### Compile-time switches for test benches

A charge transparency live link is a document from outside that names the URLs its live data is fetched from. Chargy therefore speaks only encrypted transports (`https://`, `wss://`) and only to hosts on the public internet, and no document, setting or user decision can widen that. A test bench that serves plaintext, or that lives on the local network, needs the rule lifted — which is a decision for whoever builds the application, so it is taken at compile time:

There are three kinds of build, and only one of them is relaxed:

| Build | Command | `http://`, `ws://` | Local-network hosts | `connect-src` of the page |
|-------|---------|--------------------|---------------------|---------------------------|
| Development | `npm start`, `npm run bundle` | refused | refused | `'self' https: wss:` |
| Test bench | `npm run start:testbench`, `npm run bundle:testbench` | allowed | allowed | `'self' https: wss: http: ws:` |
| Production | `npm run build:production` | refused, always | refused, always | `'self' https: wss:` |

An ordinary development build is therefore **exactly as strict as a production one** — the rules are not tied to the mode, they are tied to the switch. What production adds is that it refuses to take the switch at all.

The two switches are independent, and each can also be asked for on its own:

| Switch | Environment variable | What it allows |
|--------|----------------------|----------------|
| `--env insecureTransports` | `CHARGY_ALLOW_INSECURE_TRANSPORTS=1` | `http://` and `ws://` URLs |
| `--env privateNetworkTransports` | `CHARGY_ALLOW_PRIVATE_NETWORK_TRANSPORTS=1` | hosts on the local network (`192.168.x`, `10.x`, `fd00::`, `169.254.x`, …) |

Both are **off** by default — a plaintext bench on the LAN needs both. The ready-made way to get both is:

```
npm run start:testbench
```

which is `webpack serve` with `--env insecureTransports --env privateNetworkTransports`; `npm run bundle:testbench` does the same for a build. One switch alone is `npm run bundle -- --env insecureTransports`. The environment variables work too, but the command line exists because exporting a variable into the right shell is its own source of mistakes.

A test bench build relaxes exactly three things:

- `http://` and `ws://` URLs are used at all,
- hosts on the local network are reached,
- and the page's Content-Security-Policy adds `http:` and `ws:` to its `connect-src`. The browser is a second gate in front of every rule the application applies itself, so a switch that did not move it would let the application decide to poll and the browser refuse it — which looks exactly like a bug.

Everything else stays as it is: the consent dialog per origin, `externalURLs.conf`, the clamped `refresh` period, the capped answer size, the refused redirect, and the validation of a transport's custom headers. An application served from `localhost` could always talk to `localhost`, with or without these switches.

**A production build compiles none of it in.** `npm run build:production` ignores both switches whatever asks for them, prints a warning saying so, and keeps its `connect-src` at `'self' https: wss:`. A development build that honours a switch says so at build time and again in the browser console at startup.

So a live link document whose transports name `http://`, `ws://` or a local-network host reloads on a test bench and nowhere else — in a deployed client it is refused with a console line and nothing more. Those transports are a bench shape, never a published one.


## Deep Links

The hosted WebApp supports deep links for CPOs and backend systems that want to send customers directly to a verification result.

### Inline payloads

Small charge transparency records can be embedded directly in the URL via the `verify` query parameter:

```
https://chargy.charging.cloud?verify=<unpadded-base64url-encoded-data>
```

The `verify` value **must use unpadded Base64URL encoding** as defined by RFC 4648 section 5. Standard Base64 is not accepted: use `-` and `_` instead of `+` and `/`, and omit trailing `=` padding. The payload is decoded by the browser and then processed like data received via drag and drop or clipboard paste.

This variant should only be used for small text payloads such as compact JSON, XML or OCMF data. Large payloads are not recommended because URL size limits vary between browsers, proxies, mail clients and QR-code workflows. As a practical rule of thumb, keep the full URL below a few kilobytes whenever possible.

### External payload URLs

Larger payloads can be referenced via `verifyURL`:

```
https://chargy.charging.cloud?verifyURL=https%3A%2F%2Fapi.example.org%2Fctrs%2F12345.json
```

The `verifyURL` must reference a concrete charge transparency payload resource, not a directory or collection URL.

An optional temporary access token can be provided with the `token` query parameter:

```
https://chargy.charging.cloud?verifyURL=https%3A%2F%2Fapi.example.org%2Fctrs%2F12345.json&token=<temporary-token>
```

The WebApp appends this token to the downloaded URL as its own `token` query parameter. If the target URL already contains a query string, the token is merged into it:

```
https://api.example.org/ctrs/12345.json?format=chargy
```

becomes:

```
https://api.example.org/ctrs/12345.json?format=chargy&token=<temporary-token>
```

Alternatively, or in addition, a bearer token can be provided with the `bearerToken` query parameter:

```
https://chargy.charging.cloud?verifyURL=https%3A%2F%2Fapi.example.org%2Fctrs%2F12345.json%3Fformat%3Dchargy&bearerToken=<temporary-token>
```

This token is sent as an HTTP authorization header when downloading the payload:

```
Authorization: Bearer <temporary-token>
```

The `token` and `bearerToken` parameters may be used at the same time, even if that is redundant.

The WebApp will only download external payloads from URL prefixes explicitly allowed by a local `externalURLs.conf` file served next to `index.html`. The same file governs the second thing that fetches URLs from outside this installation: the `https` transports of a [charge transparency live link](#charge-transparency-live-links).

The file format is one rule per line:

```
# <URL-prefix> <max-payload-size-in-kbytes>
https://api.example.org/ctrs/ 100
```

Blank lines and lines starting with `#` are ignored. The requested `verifyURL` must start with one of the configured URL prefixes. Redirects are only accepted when the final URL still starts with the same allowed prefix.

An optional `mode` line decides what happens to a live link transport that **no** prefix covers:

```
mode strict
```

`mode open` (the default) offers such an origin to the user, once per origin and remembered. `mode strict` never offers and never polls it — only the listed prefixes and the installation's own origin reload, so a self-hosting operator's drivers are never asked a trust question they cannot judge. This shapes only whether Chargy *asks*; the `verifyURL` deep link knows no dialog at all and always requires a prefix here.

The size limit is enforced twice:

- If the server sends a `Content-Length` header larger than the configured limit, the download is rejected before reading the body.
- If the response is streamed without a usable `Content-Length`, the WebApp counts bytes while reading and aborts as soon as the configured limit is exceeded.

The generated build includes an empty template at `build/externalURLs.conf`. Production deployments should replace or extend this file with the allowed API prefixes.

### CORS

Because `verifyURL` downloads are performed by the user's browser, the target API must allow cross-origin requests from the WebApp origin. For the public deployment this means allowing:

```
Access-Control-Allow-Origin: https://chargy.charging.cloud
```

When `bearerToken` is used, the target API must also allow the `Authorization` request header, for example:

```
Access-Control-Allow-Headers: Authorization
```

A live link endpoint has to allow the WebApp origin the same way, and one that expects a custom header has to answer the browser's `OPTIONS` preflight as well — with a 2xx, no redirect, no authentication required, and every header named in `Access-Control-Allow-Headers`. An `Access-Control-Max-Age` keeps a ten-second poll from paying for a preflight every single time.

The WebApp fetches external payloads without credentials, so APIs should not require cookies or browser authentication for these verification payload URLs. Prefer short-lived, unguessable URLs or backend-issued tokens when payloads are not public.

Tokens passed in URLs can appear in browser history, server logs and referrer logs. They should therefore be short-lived, scoped to a single payload and invalidated after use whenever possible.


## Charge Transparency Live Links

A charge transparency record describes a charging session that has **finished**. A charge transparency live link describes one that is still **running**: it carries what is already known — the station, the meter, the public keys, the signed meter values measured so far — and says where the next version of itself can be fetched.

The WebApp reloads such a document while the session runs. Because the document comes from outside and may name any URL at all, four gates decide what is actually fetched:

- **The scheme**: only `https` and `wss`, and only hosts on the public internet. No document, setting or user decision widens this; only a [test bench build](#compile-time-switches-for-test-benches) does.
- **`externalURLs.conf`**: an origin listed there is polled without asking anyone, and so is the installation's own origin.
- **The user**, for everything else: asked once per origin and remembered — trust on first use, revocable in the settings, expiring after six months without use. The remembered decisions are stored the way OpenSSH stores a hashed `known_hosts`: salted hashes rather than the origins themselves, so a copy of the store does not reveal where its owner charges.
- **The browser's Content-Security-Policy**, which bounds the hosts the page may reach at all.

The polling period is what the document asks for, clamped: no faster than every 5 seconds, no slower than once a day, and 10 seconds when the document does not say. Answers are size-capped, redirects are refused, and a transport may state HTTP headers to send with every request — a literal value, or a one-time password computed per request with [`@open-charging-cloud/totp`](https://www.npmjs.com/package/@open-charging-cloud/totp).

The document format, what operators must provide (including the CORS preflight custom headers require), and what a client may do with these URLs are documented in [Charge Transparency Live](tests/fixtures/ChargeTransparencyLive/README.md).


## Future

The development of version **v2.x** already started and will focus on enhanced security concepts, more digital certificates and pricing information.


## Credits

- <a href="https://github.com/sirhcel">Christian Meusel</a> for more BSM validations.


## Funding

This Open Source project is partially funded by the [NGI Zero Commons Fund](https://nlnet.nl/commonsfund/) as part of our [EVQI project](https://nlnet.nl/project/EVQI/).

We also appreciate any additional funding and long-term support for the Chargy family, for example via [GitHub Sponsors](https://github.com/sponsors/GraphDefined), as it helps us keep the project sustainable, independent and useful for the entire e-mobility community.

<center>
  <img src="static/images/NGI0_tag.svg" height="30">
</center>


## Awards

The Chargy Transparency Software is one of the winners of the [1. Thuringia's Open-Source Prize](https://www.it-leistungsschau.de/programm/TOSP2019/) </a> in March 2019. This prize was awarded by [Wolfgang Tiefensee](https://de.wikipedia.org/wiki/Wolfgang_Tiefensee), [Thuringia’s Secretary of Commerce](https://www.thueringen.de/th6/tmwwdg/), in conjunction with the board of directors of the IT industry network [ITNet Thuringia](https://www.itnet-th.de).

<center>
  <img src="static/images/TMWWDG.svg" width="300"> <img src="static/images/ITnet_Thueringen_small.png" height="60">
</center>
