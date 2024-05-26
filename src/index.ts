import Alpine from 'alpinejs';
// @ts-ignore
import Interval from '@alpine-collective/toolkit-interval'
import Cookies from 'js-cookie';

(window as any).Alpine = Alpine;
(window as any).Cookies = Cookies;

type CookieObject = {
  receiveMessage: () => void;
}

type IFrameMsg = [string, any[string]];

(window as any).Alpine.data('cookie', () => ({
  cookies: [] as string[],
  isSecureFalse: false,
  isSecureTrue: true,
  initializeCheckbox() {
    const urlParams = new URLSearchParams(window.location.search);
    const uncheckedParam = urlParams.get('sc');

    if (uncheckedParam && uncheckedParam === 'false') {
      this.isSecureFalse = true;
      this.isSecureTrue = false;
    }
  },
  updateCookies() {
    this.cookies = Object.getOwnPropertyNames(Cookies.get())
  },
  cookieEmoji(name: string) {
    return this.hasCookie(name) ? "🍪" : ""
  },
  hasCookie(name: string) {
    this.updateCookies()
    return this.cookies.includes(name)
  },
  deleteAllCookies() {
    this.deleteCookies();
    this.postMessageIFrames(['deleteCookies', []]);
  },
  secureCookiesTrue(event: Event) {
    this.isSecureFalse = !this.isSecureTrue;
    this.secureCookiesFalse(event);
  },
  secureCookiesFalse(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    let foundElement: HTMLElement | null = null;
    let currentElement: HTMLElement | null = inputElement.parentElement;
    while (currentElement) {
      if (currentElement.id && (currentElement.id.startsWith('explain') || currentElement.id.startsWith('playground'))) {
          foundElement = currentElement;
          break;
      }
      currentElement = currentElement.parentElement;
    }

    this.deleteAllCookies();
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    if (this.isSecureFalse) {
      url.searchParams.set("sc", "false");
    }
    if (foundElement !== null) {
      url.hash = foundElement.id 
    }

    window.location.href = url.toString();
  },
  postMessageIFrames(msg: IFrameMsg) {
    const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe.diduthinkIFrame');
    iframes.forEach((iframe) => {
      if (iframe) {
        iframe.contentWindow?.postMessage(msg, '*');
      } else {
        console.error('Unable to find iframe.');
      }
    })
  },
  receiveMessage(msg: IFrameMsg) {
    if (msg === null) {
      console.error('Received data is not in the expected format.');
      return;
    }
   
    const [ func, args ] = msg;
    if (typeof func !== 'string' || !Array.isArray(args)) {
      // ignore this message
      return
    }

    const funcToCall = this[func as keyof CookieObject] as Function;
    if (typeof funcToCall === 'function') {
        funcToCall(...args);
    } else {
        console.error(`Function ${func} is not defined or not callable.`);
    }
  },
  deleteCookies() {
    Object.getOwnPropertyNames(Cookies.get()).forEach((c) => {
      if (! c.includes("sameSite")) {
        return
      }
      try {
        const attr = JSON.parse(atob(Cookies.get(c) || ""))
        Cookies.remove(c, attr)
      } catch (error) {
        console.error("Error parsing cookie value as json", c, error)
      }
    })
  },
  ajaxGET(): void {
    this.updateWithContent("/get", "cookieTable", "GET", this.isSecureFalse);
    this.postMessageIFrames(['updateWithContent', ["/get", "cookieTable", "GET", this.isSecureFalse]]);
  },
  ajaxPOST(): void {
    this.updateWithContent("/post", "cookieTable", "POST", this.isSecureFalse);
    this.postMessageIFrames(['updateWithContent', ["/post", "cookieTable", "POST", this.isSecureFalse]]);
  },
  updateWithContent(url: string, className: string, method: 'GET' | 'POST', isSecureFalse: boolean): void {
    const options: RequestInit = {
        method: method,
    };

    if (isSecureFalse === true) {
      if (method === 'GET') {
          url = `${url}?sc=false`;
      } else if (method === 'POST') {
        const formData = new URLSearchParams();
        formData.append('sc', 'false');
        options.body = formData;
        options.headers = {
          'Content-Type': 'application/x-www-form-urlencoded',
        };
      }
    }

    fetch(url, options)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch data from ${url}, status: ${response.status}`);
            }
            return response.text();
        })
        .then(htmlContent => {
            const elements = document.querySelectorAll(`.${className}`);
            elements.forEach(element => {
                element.innerHTML = htmlContent;
            });
        })
        .catch(error => {
            console.error(`Error updating elements: ${error.message}`);
        });
  },
}))
Alpine.plugin(Interval)
Alpine.start();
