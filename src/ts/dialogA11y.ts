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

const focusableSelector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "summary",
    "[tabindex]:not([tabindex='-1'])"
].join(", ");

export function isElementVisible(element: HTMLElement): boolean {

    if (element.hidden !== false)
        return false;

    if (typeof window !== "undefined" && typeof window.getComputedStyle === "function")
    {
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden")
            return false;
    }
    else if (element.style.display === "none" || element.style.visibility === "hidden")
    {
        return false;
    }

    return true;

}

export function getFocusableElements(container: HTMLElement): HTMLElement[] {

    const candidates = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));

    return candidates.filter(candidate => {
        if (!isElementVisible(candidate))
            return false;

        let current: HTMLElement | null = candidate.parentElement;
        while (current !== null && current !== container)
        {
            if (!isElementVisible(current))
                return false;
            current = current.parentElement;
        }

        return true;
    });

}

export function trapFocusInDialog(dialog: HTMLElement,
                                  event: KeyboardEvent): void {

    if (event.key !== "Tab")
        return;

    const focusable = getFocusableElements(dialog);

    if (focusable.length === 0)
    {
        event.preventDefault();
        dialog.focus();
        return;
    }

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (first === undefined || last === undefined)
        return;

    if (event.shiftKey)
    {
        if (active === first || active === dialog || !dialog.contains(active))
        {
            event.preventDefault();
            last.focus();
        }
    }
    else if (active === last || !dialog.contains(active))
    {
        event.preventDefault();
        first.focus();
    }

}

export function focusDialogOnOpen(dialog: HTMLElement): void {

    const focusable = getFocusableElements(dialog);
    const target = focusable[0] ?? dialog;
    target.focus();

}

export function makeKeyboardActivatable(element: HTMLElement): void {

    element.tabIndex = 0;
    element.setAttribute("role", "button");
    element.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ")
        {
            event.preventDefault();
            element.click();
        }
    });

}
