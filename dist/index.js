"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var alpinejs_1 = __importDefault(require("alpinejs"));
// @ts-ignore
var toolkit_interval_1 = __importDefault(require("@alpine-collective/toolkit-interval"));
var js_cookie_1 = __importDefault(require("js-cookie"));
window.Alpine = alpinejs_1.default;
window.Cookies = js_cookie_1.default;
window.Alpine.data('cookie', function () { return ({
    cookies: [],
    isSecureFalse: false,
    isSecureTrue: true,
    initializeCheckbox: function () {
        var urlParams = new URLSearchParams(window.location.search);
        var uncheckedParam = urlParams.get('sc');
        if (uncheckedParam && uncheckedParam === 'false') {
            this.isSecureFalse = true;
            this.isSecureTrue = false;
        }
    },
    updateCookies: function () {
        this.cookies = Object.getOwnPropertyNames(js_cookie_1.default.get());
    },
    cookieEmoji: function (name) {
        return this.hasCookie(name) ? "🍪" : "";
    },
    hasCookie: function (name) {
        this.updateCookies();
        return this.cookies.includes(name);
    },
    deleteAllCookies: function () {
        this.deleteCookies();
        this.postMessageIFrames(['deleteCookies', []]);
    },
    secureCookiesTrue: function (event) {
        this.isSecureFalse = !this.isSecureTrue;
        this.secureCookiesFalse(event);
    },
    secureCookiesFalse: function (event) {
        var inputElement = event.target;
        var foundElement = null;
        var currentElement = inputElement.parentElement;
        while (currentElement) {
            if (currentElement.id && (currentElement.id.startsWith('explain') || currentElement.id.startsWith('playground'))) {
                foundElement = currentElement;
                break;
            }
            currentElement = currentElement.parentElement;
        }
        this.deleteAllCookies();
        var url = new URL(window.location.href);
        url.search = '';
        url.hash = '';
        if (this.isSecureFalse) {
            url.searchParams.set("sc", "false");
        }
        if (foundElement !== null) {
            url.hash = foundElement.id;
        }
        window.location.href = url.toString();
    },
    postMessageIFrames: function (msg) {
        var iframes = document.querySelectorAll('iframe.diduthinkIFrame');
        iframes.forEach(function (iframe) {
            var _a;
            if (iframe) {
                (_a = iframe.contentWindow) === null || _a === void 0 ? void 0 : _a.postMessage(msg, '*');
            }
            else {
                console.error('Unable to find iframe.');
            }
        });
    },
    receiveMessage: function (msg) {
        if (msg === null) {
            console.error('Received data is not in the expected format.');
            return;
        }
        var func = msg[0], args = msg[1];
        if (typeof func !== 'string' || !Array.isArray(args)) {
            // ignore this message
            return;
        }
        var funcToCall = this[func];
        if (typeof funcToCall === 'function') {
            funcToCall.apply(void 0, args);
        }
        else {
            console.error("Function ".concat(func, " is not defined or not callable."));
        }
    },
    deleteCookies: function () {
        Object.getOwnPropertyNames(js_cookie_1.default.get()).forEach(function (c) {
            if (!c.includes("sameSite")) {
                return;
            }
            try {
                var attr = JSON.parse(atob(js_cookie_1.default.get(c) || ""));
                js_cookie_1.default.remove(c, attr);
            }
            catch (error) {
                console.error("Error parsing cookie value as json", c, error);
            }
        });
    },
    ajaxGET: function () {
        this.updateWithContent("/get", "cookieTable", "GET", this.isSecureFalse);
        this.postMessageIFrames(['updateWithContent', ["/get", "cookieTable", "GET", this.isSecureFalse]]);
    },
    ajaxPOST: function () {
        this.updateWithContent("/post", "cookieTable", "POST", this.isSecureFalse);
        this.postMessageIFrames(['updateWithContent', ["/post", "cookieTable", "POST", this.isSecureFalse]]);
    },
    updateWithContent: function (url, className, method, isSecureFalse) {
        var options = {
            method: method,
        };
        if (isSecureFalse === true) {
            if (method === 'GET') {
                url = "".concat(url, "?sc=false");
            }
            else if (method === 'POST') {
                var formData = new URLSearchParams();
                formData.append('sc', 'false');
                options.body = formData;
                options.headers = {
                    'Content-Type': 'application/x-www-form-urlencoded',
                };
            }
        }
        fetch(url, options)
            .then(function (response) {
            if (!response.ok) {
                throw new Error("Failed to fetch data from ".concat(url, ", status: ").concat(response.status));
            }
            return response.text();
        })
            .then(function (htmlContent) {
            var elements = document.querySelectorAll(".".concat(className));
            elements.forEach(function (element) {
                element.innerHTML = htmlContent;
            });
        })
            .catch(function (error) {
            console.error("Error updating elements: ".concat(error.message));
        });
    },
}); });
alpinejs_1.default.plugin(toolkit_interval_1.default);
alpinejs_1.default.start();
//# sourceMappingURL=index.js.map