import _dev from "../dev";
import _selector from "./selector";
import FastjsDomList from "./fastjsDomList";
import type {styleObj, styleObjKeys} from "./css";
import {ArrayProxyHandler} from "../proxy";
import {PushTarget} from "./elop";
import type {PushReturn} from "./elop";

type EventCallback = (el: FastjsDom, event: Event) => void;
type EachCallback = (el: FastjsDom, dom: HTMLElement, index: number) => void;
type EventList = Array<{
    type: keyof HTMLElementEventMap
    callback: EventCallback
    trigger: EventListener
    remove: () => void
}>;

type CustomProps = {
    html: string;
    text: string;
    css: styleObj;
    class: string[] | string;
    attr: { [key: string]: string | null };
    value: string;
}
type FastjsDomProps = CustomProps & {
    [K in keyof HTMLElement]: HTMLElement[K]
}

class FastjsDom {
    public readonly construct: string;
    _events: EventList = [];

    constructor(el: FastjsDom | HTMLElement | Element | string, properties?: FastjsDomProps) {
        if (__DEV__)
            _dev.browserCheck("fastjs/dom/FastjsDom")

        if (__DEV__ && el instanceof FastjsDom) {
            _dev.warn("fastjs/dom/FastjsDom", "wtf are you doing? el is already a FastjsDom", [
                "el:", el,
                "constructor(el: FastjsDom | HTMLElement | Element | string)",
                "FastjsDom"
            ]);
        }

        el = el instanceof FastjsDom ? el.el() : el;

        // if string
        if (typeof el === "string") {
            // create element
            this._el = document.createElement(el);
            if (properties) {
                let key: keyof FastjsDomProps;
                for (key in properties) {
                    const value: FastjsDomProps[keyof FastjsDomProps] = properties[key];
                    switch (key) {
                        case "html":
                            this.html(properties[key]);
                            break;
                        case "text":
                            this.text(properties[key]);
                            break;
                        case "css":
                            this.css(properties[key]);
                            break;
                        case "class": {
                            if (typeof value === "string") this.setClass(value.split(" "));
                            else if (Array.isArray(value)) this.setClass(value);
                        }
                            break;
                        case "attr": {
                            let attrKey: string;
                            for (attrKey in properties[key]) {
                                this.attr(attrKey, properties[key][attrKey]);
                            }
                        }
                            break;
                        case "value":
                            this.val(properties[key]);
                            break;
                        default:
                            this.set(key, properties[key]);
                            break;
                    }
                }

            }
        } else if (el instanceof HTMLElement) {
            this._el = el
        } else if (__DEV__) {
            _dev.warn("fastjs/dom/FastjsDom", "el is not HTMLElement or string, instead of " + typeof el, [
                "el:", el,
                "properties:", properties,
            ]);
            throw _dev.error("fastjs/dom/FastjsDom", "el is not HTMLElement or string, instead of " + typeof el, [
                "constructor(el: FastjsDom | HTMLElement | Element | string, properties?: FastjsDomProps)",
                "FastjsDom.constructor",
            ]);
        } else throw ""

        this.elClass = new Proxy(this, {})

        // construct
        this.construct = "FastjsDom";

        return this;
    }

    [key: string]: any;

    _el: HTMLElement

    // methods

    attr(key: string): string | null
    attr(key: string, value: string | null): FastjsDom

    attr(key: string, value?: string | null): string | null | FastjsDom {
        if (value === undefined) return this._el.getAttribute(key);
        if (value) this._el.setAttribute(key, value.toString());
        else this._el.removeAttribute(key);
        return this;
    }

    addAfter(el: HTMLElement): FastjsDom {
        if (!el.parentNode)
            _dev.warn("fastjs/dom/addAfter", "el.parentNode is null", [
                "addAfter(el: HTMLElement)",
                "domEdit.ts",
                "FastjsDom"
            ]);
        else
            // add this._el after el
            el.parentNode.insertBefore(this._el, el.nextSibling);
        return this;
    }

    addBefore(el: HTMLElement): FastjsDom {
        if (!el.parentNode)
            _dev.warn("fastjs/dom/addBefore", "el.parentNode is null", [
                "addAfter(el: HTMLElement)",
                "domEdit.ts",
                "FastjsDom"
            ]);
        else
            // add this._el before el
            el.parentNode.insertBefore(this._el, el);

        return this;
    }

    addFirst(el: HTMLElement): FastjsDom {
        // add this._el first in el
        el.insertBefore(this._el, el.firstChild);
        return this;
    }

    append(el: HTMLElement): FastjsDom {
        this._el.appendChild(el);
        return this;
    }

    appendTo(el: HTMLElement = document.body): FastjsDom {
        el.appendChild(this._el);
        return this;
    }

    css(): styleObj
    css(key: styleObj): FastjsDom
    css<T extends styleObjKeys>(key: T, value: styleObj[T], other?: string): FastjsDom

    css<T extends styleObjKeys>(key?: T | styleObj, value?: styleObj[T], other?: string): FastjsDom | styleObj {
        const style = this.get("style") as CSSStyleDeclaration;
        if (!key) return style as styleObj;
        if (typeof key === "object") {
            let k: styleObjKeys;
            for (k in key) {
                style.setProperty(k as string, key[k]);
            }
        }
        if (typeof key === "string" && value) {
            style.setProperty(key, value, other);
        }
        return this;
    }

    el(): HTMLElement {
        return this._el;
    }

    each(callback: EachCallback): FastjsDom {
        // children each
        for (let i = 0; i < this._el.children.length; i++) {
            callback(new FastjsDom(this._el.children[i] as HTMLElement), this._el.children[i] as HTMLElement, i);
        }
        return this;
    }

    focus(): FastjsDom {
        this._el.focus();
        return this;
    }

    firstChild(): FastjsDom | null {
        return this._el.firstElementChild ? new FastjsDom(this._el.firstElementChild as HTMLElement) : null;
    }

    lastChild(): FastjsDom | null {
        return this._el.lastElementChild ? new FastjsDom(this._el.lastElementChild as HTMLElement) : null;
    }

    children(): FastjsDomList {
        return new FastjsDomList([...this._el.children]);
    }

    father(): FastjsDom | null {
        return new FastjsDom(this.get("parentNode") as HTMLElement);
    }

    get<T extends keyof HTMLElement>(key: T): HTMLElement[T] {
        return this._el[key];
    }

    html(): string
    html(val: string): FastjsDom

    html(val?: string): string | FastjsDom {
        // if null -> not change || String(val)
        this._el.innerHTML = val !== undefined ? val : this._el.innerHTML;
        return val !== undefined ? this : this._el.innerHTML;
    }

    last(): FastjsDom | null {
        return this._el.lastElementChild ? new FastjsDom(this._el.lastElementChild as HTMLElement) : null;
    }

    next(selector: string): FastjsDom | FastjsDomList | null {
        return _selector(selector, this._el);
    }

    // push(el: HTMLElement = document.body): FastjsDom {
    //     if (__DEV__) {
    //         _dev.warn("fastjs/dom/push", "This function's return value changed into `FastjsDom(el)` from `this`, you need to change your code manually if you use like .push(el).xxx, or you can use appendTo(el) instead of push(el).");
    //     }
    //     return new FastjsDom(el.appendChild(this._el));
    // }
    push<T extends PushTarget>(el?: HTMLElement | FastjsDomList | FastjsDom, target?: T): PushReturn<T>
    push<T extends PushTarget>(el?: HTMLElement | FastjsDomList | FastjsDom, callback?: (pushReturn: PushReturn<T>) => void, target?: T): FastjsDom

    push<T extends PushTarget>(el: HTMLElement | FastjsDomList | FastjsDom = document.body, callbackOrTarget: ((pushReturn: PushReturn<T>) => void) | T = PushTarget.lastElementChild as T, target: T = PushTarget.lastElementChild as T): PushReturn<T> | FastjsDom {

        const solve = (result: PushReturn<T>): FastjsDom | PushReturn<T> => {
            if (typeof callbackOrTarget !== "function") return result;
            callbackOrTarget(result);
            return this;
        }

        const _target: T = typeof callbackOrTarget === "function" ? target : callbackOrTarget;

        el = el instanceof HTMLElement ? el : el.el();
        if (el.parentNode === null) {
            if (__DEV__) {
                _dev.warn("fastjs/dom/push", "el.parentNode is null", [
                    "el:", el,
                    "target: " + target,
                    "FastjsDom.push(el, target)",
                ]);
                throw _dev.error("fastjs/dom/push", "el.parentNode can't be null", [
                    "Serious Warning -> Error",
                    "FastjsDom.push(el, target)"
                ])
            }
            throw ""
        }
        // if replace
        if (_target === PushTarget.replaceElement) {
            const oldElement = new FastjsDom(el);
            const added = el.parentNode.replaceChild(this._el, el);
            const newEl = new FastjsDom(added);
            return solve({
                isReplace: true,
                newElement: newEl,
                oldElement: oldElement,
                index: newEl.father()?.children().toElArray().indexOf(added),
                el: newEl,
                origin: added,
                father: newEl.father(),
                _this: this
            } as unknown as PushReturn<T>);
        } else {
            let added;
            switch (_target) {
                case PushTarget.firstElementChild:
                    added = el.insertBefore(this._el, el.firstElementChild);
                    break;
                case PushTarget.lastElementChild:
                    added = el.appendChild(this._el);
                    break;
                case PushTarget.beforeElement:
                    added = el.parentNode.insertBefore(this._el, el);
                    break;
                case PushTarget.afterElement:
                    added = el.parentNode.insertBefore(this._el, el.nextSibling);
                    break;
            }
            const newEl = new FastjsDom(added as HTMLElement);
            return solve({
                isReplace: false,
                index: newEl.father()?.children().toElArray().indexOf(added as HTMLElement),
                el: newEl,
                origin: added,
                father: newEl.father(),
                _this: this
            } as unknown as PushReturn<T>);
        }
    }


    addEvent(event: keyof HTMLElementEventMap = "click", callback: EventCallback): FastjsDom {
        let eventTrig: EventListener | EventListenerObject = (event: Event) => callback(this, event);
        this._events.push({
            type: event,
            callback: callback,
            trigger: eventTrig,
            remove: () => {
                this.removeEvent(callback)
            }
        });
        console.log("add", eventTrig)
        this._el.addEventListener(event, eventTrig);
        return this;
    }

    getEvent(): EventList
    getEvent(type: keyof HTMLElementEventMap): EventCallback | null
    getEvent(callback: (eventList: EventList) => void): FastjsDom
    getEvent(type: keyof HTMLElementEventMap, callback: (event: EventCallback | null) => void): FastjsDom

    getEvent(typeOrCallback?: keyof HTMLElementEventMap | ((eventList: EventList) => void), callback?: (event: EventCallback | null) => void): EventList | EventCallback | null | FastjsDom {
        if (typeof typeOrCallback === "string")
            if (callback)
                callback(this._events.find((v) => v.type === typeOrCallback)?.callback || null);
            else
                return this._events.find((v) => v.type === typeOrCallback)?.callback || null;
        else if (typeof typeOrCallback === "function")
            typeOrCallback(this._events);
        else
            return this._events;

        return this;
    }

    removeEvent(): FastjsDom
    removeEvent(type: keyof HTMLElementEventMap): FastjsDom
    removeEvent(key: number): FastjsDom
    removeEvent(type: keyof HTMLElementEventMap, key: number): FastjsDom
    removeEvent(callback: EventCallback): FastjsDom

    removeEvent(typeOrKeyOrCallback?: keyof HTMLElementEventMap | number | EventCallback, key?: number): FastjsDom {
        if (__DEV__) {
            if (typeOrKeyOrCallback === undefined) {
                _dev.warn("fastjs/dom/removeEvent", "You are removing all events, make sure you want to do this.", [
                    "removeEvent(typeOrKey?: keyof HTMLElementEventMap | number, key?: number)",
                    "FastjsDom:", this._el
                ]);
            }
            if (typeof typeOrKeyOrCallback === "string" && key === undefined) {
                _dev.warn("fastjs/dom/removeEvent", "You are removing all events with type " + typeOrKeyOrCallback + ", make sure you want to do this.", [
                    "removeEvent(typeOrKey?: keyof HTMLElementEventMap | number, key?: number)",
                    "FastjsDom:", this._el
                ]);
            }
        }

        if (typeof typeOrKeyOrCallback === "string")
            if (key !== undefined) {
                this._el.removeEventListener(typeOrKeyOrCallback, this._events.filter((v) => v.type === typeOrKeyOrCallback)[key].trigger as Function as EventListener);
                this._events.splice(key, 1);
            } else
                this._events.filter((v) => v.type === typeOrKeyOrCallback).forEach((v) => {
                    this._el.removeEventListener(v.type, v.trigger as Function as EventListener);
                    this._events.splice(this._events.indexOf(v), 1);
                });
        else if (typeof typeOrKeyOrCallback === "number") {
            this._el.removeEventListener(this._events[typeOrKeyOrCallback].type, this._events[typeOrKeyOrCallback].trigger as Function as EventListener);
            this._events.splice(typeOrKeyOrCallback, 1);
        } else if (typeof typeOrKeyOrCallback === "function") {
            this._events.filter((v) => v.callback === typeOrKeyOrCallback).forEach((v) => {
                console.log("find", v)
                this._el.removeEventListener(v.type, v.trigger as Function as EventListener);
            });
            this._events = this._events.filter((v) => v.callback !== typeOrKeyOrCallback);
        } else {
            this._events.forEach((v) => {
                v.remove();
            });
            this._events = [];
        }

        return this;
    }


    remove(): FastjsDom {
        this._el.remove();
        return this;
    }

    set<T extends keyof HTMLElement>(key: T, val: HTMLElement[T]): FastjsDom {
        if (Object.getOwnPropertyDescriptor(Element.prototype, key)?.writable ||
            Object.getOwnPropertyDescriptor(Element.prototype, key)?.set
        ) {
            this._el[key] = val;
        } else
            _dev.warn("fastjs/dom/set", "key is not writable", [
                "key: " + key,
                "set<T extends keyof HTMLElement>(key: T, val: HTMLElement[T]): FastjsDom",
                "FastjsDom"
            ]);
        return this;
    }

    text(): string
    text(val: string): FastjsDom

    text(val?: string): string | FastjsDom {
        // if null -> not change || String(val)
        this._el.innerText = val !== undefined ? val : this._el.innerText;
        return val !== undefined ? this : this._el.innerText;
    }

    then(callback: (el: FastjsDom, dom: HTMLElement) => void, time = 0): FastjsDom {
        if (time)
            setTimeout(() => {
                callback(this, this.el());
            }, time);
        else
            callback(this, this.el());
        return this;
    }

    val(): string
    val(val: string): FastjsDom

    val(val?: string): FastjsDom | string {
        const btn = this._el instanceof HTMLButtonElement;
        if (this._el instanceof HTMLInputElement || this._el instanceof HTMLTextAreaElement || this._el instanceof HTMLButtonElement) {
            // if val and is button || input || textarea
            if (val === undefined) {
                return btn ? this._el.innerText : this._el.value;
            } else {
                if (btn)
                    this._el.innerText = val;
                else
                    this._el.value = val;
            }
        } else {
            _dev.warn("fastjs/dom/val", "This element is not a input or textarea or button, instanceof " + this._el.constructor.name);
        }
        return this;
    }

    /** @description Class Functions */

    addClass(className: string[]): FastjsDom
    addClass(...className: string[]): FastjsDom

    addClass(className: string | string[]): FastjsDom {
        return this.setClass(Array.isArray(className) ? className : [...arguments]);
    }

    clearClass(): FastjsDom {
        return this.removeClass(...this._el.classList);
    }

    removeClass(className: string[]): FastjsDom
    removeClass(...className: string[]): FastjsDom

    removeClass(className: string | string[]): FastjsDom {
        const classList: string[] = Array.isArray(className) ? className : [...arguments];
        classList.forEach((v) => {
            this.setClass(v, false);
        });
        return this;
    }

    setClass(): FastjsDom
    setClass(className: string, value?: boolean): FastjsDom
    setClass(classNames: string[]): FastjsDom
    setClass(classNames: { [key: string]: boolean }): FastjsDom

    setClass(classNames?: string | string[] | { [key: string]: boolean }, value: boolean = true): FastjsDom {
        if (typeof classNames === "string")
            this._el.classList[value ? "add" : "remove"](classNames);
        else if (Array.isArray(classNames))
            classNames.forEach((v) => {
                this._el.classList.add(v);
            })
        else if (typeof classNames === "object")
            Object.entries(classNames).forEach((v) => {
                this._el.classList[v[1] ? "add" : "remove"](v[0]);
            })
        else this._el.classList.remove(...this._el.classList);

        return this;
    }

    getClass(): string[]
    getClass(className: string): boolean
    getClass(callback: (classNames: string[]) => void): FastjsDom
    getClass(className: string, callback: (value: boolean) => void): FastjsDom

    getClass(classNameOrCallback?: string | ((classNames: string[]) => void), callback?: (value: boolean) => void): string[] | boolean | FastjsDom {
        const getClassProxy = (): string[] => {
            const handler: ArrayProxyHandler<string> = {
                get: (target, key: PropertyKey) => {
                    return Reflect.get(target, key);
                },
                set: (target, key: PropertyKey, value) => {
                    if (!Number.isNaN(Number(key))) this.setClass(value);
                    return Reflect.set(target, key, value);
                }
            }
            return new Proxy([...this._el.classList], handler)
        }

        if (typeof classNameOrCallback === "string")
            if (callback)
                callback(this._el.classList.contains(classNameOrCallback));
            else
                return this._el.classList.contains(classNameOrCallback);
        else if (typeof classNameOrCallback === "function")
            classNameOrCallback(getClassProxy());
        else
            return getClassProxy()

        return this;
    }
}

export default FastjsDom
export type {EachCallback, EventCallback, FastjsDomProps}