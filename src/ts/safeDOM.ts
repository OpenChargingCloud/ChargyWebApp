/*
 * Copyright (c) 2018-2026 GraphDefined GmbH <achim.friedland@graphdefined.com>
 * This file is part of Chargy WebApp <https://github.com/OpenChargingCloud/ChargyWebApp>
 *
 * Licensed under the Affero GPL license, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.gnu.org/licenses/agpl.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export function createDiv(parent: HTMLElement,
                          className?: string,
                          text?: string): HTMLDivElement {

    const childDiv = parent.appendChild(document.createElement("div"));

    if (className !== undefined && className !== "")
        childDiv.className = className;

    if (text !== undefined)
        childDiv.textContent = text;

    return childDiv;

}

export function createDiv2(parent: HTMLElement,
                           childClassName: string,
                           labelText: string,
                           value: string | Node): HTMLDivElement {

    const childDiv = parent.appendChild(document.createElement("div"));
    childDiv.className = childClassName;

    const childADiv = childDiv.appendChild(document.createElement("div"));
    childADiv.className = childClassName + "Id";
    childADiv.textContent = labelText;

    const childBDiv = childDiv.appendChild(document.createElement("div"));
    childBDiv.className = childClassName + "Value";

    if (typeof value === "string")
        childBDiv.textContent = value;
    else
        childBDiv.appendChild(value);

    return childDiv;

}

export function createIcon(iconClassName: string): HTMLElement {

    const icon = document.createElement("i");
    icon.className = iconClassName;
    return icon;

}

export function setIconContent(element: Element,
                               iconClassName: string,
                               text?: string,
                               separator: string = " "): void {

    const nodes: Node[] = [ createIcon(iconClassName) ];

    if (text !== undefined && text !== "")
        nodes.push(document.createTextNode(separator + text));

    element.replaceChildren(...nodes);

}

export function appendRelevanceBadge(parent: HTMLElement,
                                     label: string): void {

    parent.appendChild(document.createTextNode(" "));

    const span = parent.appendChild(document.createElement("span"));
    span.className = "relevance";
    span.textContent = "(" + label + ")";

}

export function createSafeExternalLink(text: string,
                                       rawURL: string | undefined): HTMLAnchorElement | Text {

    if (rawURL !== undefined && rawURL.trim() !== "")
    {
        try
        {
            const parsed = new URL(rawURL.trim());

            if (parsed.protocol === "https:" || parsed.protocol === "http:")
            {
                const anchor = document.createElement("a");
                anchor.href = parsed.href;
                anchor.target = "_blank";
                anchor.rel = "noopener noreferrer";
                anchor.textContent = text;
                return anchor;
            }
        }
        catch
        {
            // Fall back to plain text for malformed or relative URLs.
        }
    }

    return document.createTextNode(text);

}

export function createTextPopup(text: string): HTMLDivElement {

    const popup = document.createElement("div");
    popup.textContent = text;
    return popup;

}

const importantSpanPattern = /<span class="important">([\s\S]*?)<\/span>/g;

/**
 * Renders localized text without innerHTML.
 * Only the single trusted `<span class="important">...</span>` highlight used
 * in bundled i18n messages is converted into a span element; everything else
 * becomes plain text nodes.
 */
export function setLocalizedContent(element: HTMLElement,
                                    message: string): void {

    const nodes: Node[] = [];
    let lastIndex = 0;

    for (const match of message.matchAll(importantSpanPattern))
    {
        const matchIndex = match.index;
        const innerText = match[1] ?? "";

        if (matchIndex > lastIndex)
            nodes.push(document.createTextNode(message.slice(lastIndex, matchIndex)));

        const span = document.createElement("span");
        span.className = "important";
        span.textContent = innerText;
        nodes.push(span);

        lastIndex = matchIndex + match[0].length;
    }

    if (lastIndex < message.length)
        nodes.push(document.createTextNode(message.slice(lastIndex)));

    element.replaceChildren(...nodes);

}
