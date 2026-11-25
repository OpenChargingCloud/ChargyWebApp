import { afterEach, describe, expect, test } from 'vitest';
import {
    focusDialogOnOpen,
    getFocusableElements,
    makeKeyboardActivatable,
    trapFocusInDialog
} from '../src/ts/dialogA11y';

class FakeFocusableElement {
    public hidden = false;
    public readonly style = { display: '', visibility: '' };
    public parentElement: FakeFocusableElement | null = null;
    public tabIndex = -1;
    public readonly attributes: Record<string, string> = {};
    public focused = false;
    public clicked = 0;
    private readonly descendants: FakeFocusableElement[] = [];
    private readonly keydownListeners: Array<(event: KeyboardEvent) => void> = [];

    public addChild(child: FakeFocusableElement): FakeFocusableElement {
        child.parentElement = this;
        this.descendants.push(child);
        return child;
    }

    public contains(node: unknown): boolean {
        if (node === this)
            return true;
        return this.descendants.some(child => child === node || child.contains(node));
    }

    public querySelectorAll(): FakeFocusableElement[] {
        return [...this.descendants];
    }

    public focus(): void {
        this.focused = true;
        (globalThis.document as unknown as { activeElement: unknown }).activeElement = this;
    }

    public click(): void {
        this.clicked++;
    }

    public setAttribute(name: string, value: string): void {
        this.attributes[name] = value;
    }

    public addEventListener(type: string, listener: (event: KeyboardEvent) => void): void {
        if (type === 'keydown')
            this.keydownListeners.push(listener);
    }

    public dispatchKey(key: string): { defaultPrevented: boolean } {
        let defaultPrevented = false;
        const event = {
            key,
            preventDefault: (): void => { defaultPrevented = true; }
        } as unknown as KeyboardEvent;
        for (const listener of this.keydownListeners)
            listener(event);
        return { defaultPrevented };
    }
}

describe('dialogA11y helpers', () => {
    const originalDocument = globalThis.document;

    afterEach(() => {
        globalThis.document = originalDocument;
    });

    test('getFocusableElements excludes hidden elements and elements inside hidden ancestors', () => {
        const dialog = new FakeFocusableElement();
        const visibleBtn = dialog.addChild(new FakeFocusableElement());
        const hiddenBtn = dialog.addChild(new FakeFocusableElement());
        hiddenBtn.hidden = true;
        const hiddenContainer = new FakeFocusableElement();
        hiddenContainer.style.display = 'none';
        hiddenContainer.parentElement = dialog;
        const nestedHiddenBtn = dialog.addChild(new FakeFocusableElement());
        nestedHiddenBtn.parentElement = hiddenContainer;

        const focusable = getFocusableElements(dialog as unknown as HTMLElement);
        expect(focusable).toEqual([ visibleBtn ]);
    });

    test('focusDialogOnOpen focuses the first focusable element, or the dialog itself when empty', () => {
        globalThis.document = { activeElement: null } as unknown as Document;

        const dialog = new FakeFocusableElement();
        const first = dialog.addChild(new FakeFocusableElement());
        dialog.addChild(new FakeFocusableElement());

        focusDialogOnOpen(dialog as unknown as HTMLElement);
        expect(first.focused).toBe(true);

        const emptyDialog = new FakeFocusableElement();
        focusDialogOnOpen(emptyDialog as unknown as HTMLElement);
        expect(emptyDialog.focused).toBe(true);
    });

    test('trapFocusInDialog wraps Tab and Shift+Tab within the modal dialog', () => {
        const dialog = new FakeFocusableElement();
        const first = dialog.addChild(new FakeFocusableElement());
        const last  = dialog.addChild(new FakeFocusableElement());
        globalThis.document = { activeElement: last } as unknown as Document;

        let prevented = false;
        trapFocusInDialog(dialog as unknown as HTMLElement, {
            key: 'Tab',
            shiftKey: false,
            preventDefault: (): void => { prevented = true; }
        } as unknown as KeyboardEvent);

        expect(prevented).toBe(true);
        expect(first.focused).toBe(true);

        prevented = false;
        trapFocusInDialog(dialog as unknown as HTMLElement, {
            key: 'Tab',
            shiftKey: true,
            preventDefault: (): void => { prevented = true; }
        } as unknown as KeyboardEvent);

        expect(prevented).toBe(true);
        expect(last.focused).toBe(true);
    });

    test('makeKeyboardActivatable enables Enter and Space activation with button role', () => {
        const card = new FakeFocusableElement();
        makeKeyboardActivatable(card as unknown as HTMLElement);

        expect(card.tabIndex).toBe(0);
        expect(card.attributes['role']).toBe('button');

        expect(card.dispatchKey('Enter').defaultPrevented).toBe(true);
        expect(card.clicked).toBe(1);

        expect(card.dispatchKey(' ').defaultPrevented).toBe(true);
        expect(card.clicked).toBe(2);

        expect(card.dispatchKey('Escape').defaultPrevented).toBe(false);
        expect(card.clicked).toBe(2);
    });
});
