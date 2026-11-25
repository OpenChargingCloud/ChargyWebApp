import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
    appendRelevanceBadge,
    createDiv,
    createDiv2,
    createSafeExternalLink,
    createTextPopup,
    setIconContent,
    setLocalizedContent
} from '../src/ts/safeDOM';

interface FakeNode {
    readonly kind: 'element' | 'text';
    textContent: string;
}

class FakeText implements FakeNode {
    public readonly kind = 'text' as const;
    public textContent: string;

    public constructor(text: string) {
        this.textContent = text;
    }
}

class FakeElement implements FakeNode {
    public readonly kind = 'element' as const;
    public readonly tagName: string;
    public className = '';
    public href = '';
    public target = '';
    public rel = '';
    public readonly attributes: Record<string, string> = {};
    public readonly children: FakeNode[] = [];
    private ownText = '';

    public constructor(tagName: string) {
        this.tagName = tagName.toLowerCase();
    }

    public setAttribute(name: string, value: string): void {
        this.attributes[name] = value;
    }

    public get textContent(): string {
        if (this.children.length === 0)
            return this.ownText;
        return this.children.map(child => child.textContent).join('');
    }

    public set textContent(value: string) {
        this.children.length = 0;
        this.ownText = value;
    }

    public appendChild<T extends FakeNode>(node: T): T {
        this.ownText = '';
        this.children.push(node);
        return node;
    }

    public replaceChildren(...nodes: FakeNode[]): void {
        this.ownText = '';
        this.children.length = 0;
        this.children.push(...nodes);
    }
}

const xssPayload = '<img src=x onerror="alert(1)"><script>alert(2)</script>';

describe('safeDOM helpers', () => {
    const originalDocument = globalThis.document;

    beforeEach(() => {
        globalThis.document = {
            createElement: (tag: string): FakeElement => new FakeElement(tag),
            createTextNode: (text: string): FakeText => new FakeText(text)
        } as unknown as Document;
    });

    afterEach(() => {
        globalThis.document = originalDocument;
    });

    test('createDiv renders untrusted text strictly as textContent', () => {
        const parent = new FakeElement('div');
        const child = createDiv(parent as unknown as HTMLElement, 'value', xssPayload) as unknown as FakeElement;

        expect(parent.children).toHaveLength(1);
        expect(child.className).toBe('value');
        expect(child.children).toHaveLength(0);
        expect(child.textContent).toBe(xssPayload);
    });

    test('createDiv2 renders label and untrusted string value as plain text', () => {
        const parent = new FakeElement('div');
        const row = createDiv2(parent as unknown as HTMLElement, 'meterId', 'Serial', xssPayload) as unknown as FakeElement;

        expect(row.className).toBe('meterId');
        expect(row.children).toHaveLength(2);
        const label = row.children[0] as FakeElement;
        const value = row.children[1] as FakeElement;
        expect(label.className).toBe('meterIdId');
        expect(label.textContent).toBe('Serial');
        expect(value.className).toBe('meterIdValue');
        expect(value.children).toHaveLength(0);
        expect(value.textContent).toBe(xssPayload);
    });

    test('createSafeExternalLink allows http/https with noopener noreferrer and literal text', () => {
        const node = createSafeExternalLink(xssPayload, ' https://example.org/docs?a=1&b=2 ') as unknown as FakeElement;

        expect(node.kind).toBe('element');
        expect(node.tagName).toBe('a');
        expect(node.href).toBe('https://example.org/docs?a=1&b=2');
        expect(node.target).toBe('_blank');
        expect(node.rel).toBe('noopener noreferrer');
        expect(node.children).toHaveLength(0);
        expect(node.textContent).toBe(xssPayload);
    });

    test.each([
        undefined,
        '',
        '   ',
        'javascript:alert(1)',
        "javascript:OpenLink('https://example.org')",
        'JAVASCRIPT:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'wss://live.example.org/stream',
        '/relative/path'
    ])('createSafeExternalLink downgrades unsafe or non-http(s) URL to inert text: %s', rawURL => {
        const node = createSafeExternalLink('Vendor <script>', rawURL) as unknown as FakeNode;

        expect(node.kind).toBe('text');
        expect(node.textContent).toBe('Vendor <script>');
    });

    test('setIconContent builds an icon element plus plain text node', () => {
        const target = new FakeElement('div');
        setIconContent(target as unknown as Element, 'fas fa-times-circle', xssPayload);

        expect(target.children).toHaveLength(2);
        const icon = target.children[0] as FakeElement;
        const text = target.children[1] as FakeText;
        expect(icon.tagName).toBe('i');
        expect(icon.className).toBe('fas fa-times-circle');
        expect(icon.attributes['aria-hidden']).toBe('true');
        expect(text.kind).toBe('text');
        expect(text.textContent).toBe(' ' + xssPayload);
    });

    test('appendRelevanceBadge wraps untrusted relevance label as text', () => {
        const target = new FakeElement('div');
        appendRelevanceBadge(target as unknown as HTMLElement, xssPayload);

        expect(target.children).toHaveLength(2);
        const badge = target.children[1] as FakeElement;
        expect(badge.tagName).toBe('span');
        expect(badge.className).toBe('relevance');
        expect(badge.children).toHaveLength(0);
        expect(badge.textContent).toBe('(' + xssPayload + ')');
    });

    test('createTextPopup creates a div with literal textContent', () => {
        const popup = createTextPopup(xssPayload) as unknown as FakeElement;

        expect(popup.tagName).toBe('div');
        expect(popup.children).toHaveLength(0);
        expect(popup.textContent).toBe(xssPayload);
    });

    test('setLocalizedContent only converts trusted important spans and keeps other markup inert', () => {
        const target = new FakeElement('span');
        setLocalizedContent(
            target as unknown as HTMLElement,
            'Data is <span class="important">metrological</span> and <b>not bold</b> <img src=x onerror=alert(1)>'
        );

        expect(target.children).toHaveLength(3);
        expect((target.children[0] as FakeText).kind).toBe('text');
        expect(target.children[0]?.textContent).toBe('Data is ');
        const important = target.children[1] as FakeElement;
        expect(important.tagName).toBe('span');
        expect(important.className).toBe('important');
        expect(important.textContent).toBe('metrological');
        expect((target.children[2] as FakeText).kind).toBe('text');
        expect(target.children[2]?.textContent).toBe(' and <b>not bold</b> <img src=x onerror=alert(1)>');
    });
});
