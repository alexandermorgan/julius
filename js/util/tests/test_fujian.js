// -*- coding: utf-8 -*-
// ------------------------------------------------------------------------------------------------
// Program Name:           Julius
// Program Description:    User interface for the nCoda music notation editor.
//
// Filename:               js/util/tests/test_fujian.js
// Purpose:                Tests for js/util/fujian.js
//
// Copyright (C) 2016, 2017 Christopher Antila
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
// ------------------------------------------------------------------------------------------------


import Immutable from 'immutable';

jest.mock('../log');

import { store } from '../../stores';
import { actions as metaActions, getters as metaGetters, LOG_LEVELS } from '../../stores/meta';
import { getters as uiGetters } from '../../stores/ui';

import log from '../log';
const fujian = require('../fujian.js');  // TODO: get rid of this import
import {
    WS_CLOSE_CODE,
    WS_RESTART_DELAY,
    WS_STATUS,
} from '../fujian';


describe("Fujian class' instance methods", () => {
    const xhrMock = {
        addEventListener: jest.genMockFn(),
        open: jest.genMockFn(),
        send: jest.genMockFn(),
    };

    beforeAll(() => {
        window.setTimeout = jest.fn();
        window.WebSocket = jest.genMockFn();
        window.XMLHttpRequest = () => xhrMock;
    });

    beforeEach(() => {
        log.error.mockClear();
        log.warn.mockClear();
        log.info.mockClear();
        log.debug.mockClear();
        window.setTimeout.mockClear();
        window.WebSocket.mockClear();
        xhrMock.addEventListener.mockClear();
        xhrMock.open.mockClear();
        xhrMock.send.mockClear();
        store.dispatch({ type: 'RESET' });
    });

    describe('constructor()', () => {
        it('initializes properly', () => {
            const actual = new fujian.Fujian();
            expect(actual._fujian).toBe(null);
            expect(typeof actual.startWS === 'function').toBeTruthy();
            expect(typeof actual.stopWS === 'function').toBeTruthy();
            expect(typeof actual.statusWS === 'function').toBeTruthy();
            expect(typeof actual.sendAjax === 'function').toBeTruthy();
            expect(typeof actual._sendWSWhenReady === 'function').toBeTruthy();
            expect(typeof actual.sendWS === 'function').toBeTruthy();
            expect(typeof actual._errorWS === 'function').toBeTruthy();
            expect(Immutable.List.isList(actual._sendWhenReady)).toBeTruthy();
        });
    });

    describe('startWS()', () => {
        it('sets up a new WebSocket connection', () => {
            const actual = new fujian.Fujian();
            actual.statusWS = () => WS_STATUS.CLOSED;
            actual.startWS();
            expect(window.WebSocket).toBeCalledWith(fujian.FUJIAN_WS_URL);
            expect(actual._fujian).toBe(window.WebSocket.mock.instances[0]);
            expect(actual._fujian.onmessage).toBe(fujian.Fujian._receiveWS);
            expect(actual._fujian.onerror).toBe(actual._errorWS);
            expect(actual._fujian.onopen).toBe(actual._sendWSWhenReady);
        });

        it('shows an INFO message if there is an existing WebSocket connection', () => {
            const actual = new fujian.Fujian();
            actual.statusWS = () => WS_STATUS.OPEN;
            actual.startWS();
            expect(log.info).toBeCalledWith(fujian.ERROR_MESSAGES.wsAlreadyOpen);
            expect(window.WebSocket).not.toBeCalled();
        });
    });

    describe('stopWS()', () => {
        it('stopWS() calls close() when the WebSocket connection is "open"', () => {
            const actual = new fujian.Fujian();
            actual.statusWS = () => WS_STATUS.OPEN;
            const wsMock = { close: jest.genMockFn() };
            actual._fujian = wsMock;
            actual.stopWS();
            expect(wsMock.close).toBeCalledWith(WS_CLOSE_CODE);
            expect(actual._fujian).toBe(null);
        });

        it('stopWS() calls close() when the WebSocket connection is "connecting"', () => {
            const actual = new fujian.Fujian();
            actual.statusWS = () => WS_STATUS.CONNECTING;
            const wsMock = { close: jest.genMockFn() };
            actual._fujian = wsMock;
            actual.stopWS();
            expect(wsMock.close).toBeCalledWith(WS_CLOSE_CODE);
            expect(actual._fujian).toBe(null);
        });

        it('stopWS() does not call close() when the WebSocket connection is "closed"', () => {
            const actual = new fujian.Fujian();
            actual.statusWS = () => WS_STATUS.CLOSED;
            const wsMock = { close: jest.genMockFn() };
            actual._fujian = wsMock;
            actual.stopWS();
            expect(wsMock.close).not.toBeCalled();
            expect(actual._fujian).toBe(wsMock);
        });
    });

    describe('statusWS()', () => {
        it('statusWS() returns "connecting" when appropriate', () => {
            const actual = new fujian.Fujian();
            actual._fujian = { readyState: 0 };
            expect(actual.statusWS()).toBe(WS_STATUS.CONNECTING);
        });

        it('statusWS() returns "open" when appropriate', () => {
            const actual = new fujian.Fujian();
            actual._fujian = { readyState: 1 };
            expect(actual.statusWS()).toBe(WS_STATUS.OPEN);
        });

        it('statusWS() returns "closed" with readyState greater than 1', () => {
            const actual = new fujian.Fujian();
            actual._fujian = { readyState: 2 };
            expect(actual.statusWS()).toBe(WS_STATUS.CLOSED);
        });

        it('statusWS() returns "closed" when _fujian is nulll', () => {
            const actual = new fujian.Fujian();
            actual._fujian = null;
            expect(actual.statusWS()).toBe(WS_STATUS.CLOSED);
        });
    });

    describe('sendAjax()', () => {
        it('works', () => {
            const actual = new fujian.Fujian();
            const code = 'some code';
            actual.sendAjax(code);

            expect(xhrMock.addEventListener).toBeCalledWith('error', fujian.Fujian._errorAjax);
            expect(xhrMock.addEventListener).toBeCalledWith('abort', fujian.Fujian._abortAjax);
            expect(xhrMock.addEventListener).toBeCalledWith('load', fujian.Fujian._loadAjax);
            expect(xhrMock.open).toBeCalledWith('POST', fujian.FUJIAN_AJAX_URL);
            expect(xhrMock.send).toBeCalledWith(code);
            const theStore = store.getState();
            expect(metaGetters.stdin(theStore)).toBe(`${code}<br>`);
        });
    });

    describe ('_sendWSWhenReady()', () => {
        it('does not call sendWS() when there is nothing to send', () => {
            const actual = new fujian.Fujian();
            actual.statusWS = () => 'open';
            actual.sendWS = jest.genMockFn();
            actual._sendWhenReady = Immutable.List();

            actual._sendWSWhenReady();

            expect(actual.sendWS).not.toBeCalled();
            expect(actual._sendWhenReady).toBe(null);
        });

        it('calls sendWS() when there are things to send', () => {
            const actual = new fujian.Fujian();
            actual.statusWS = () => 'open';
            actual.sendWS = jest.genMockFn();
            actual._sendWhenReady = Immutable.List(['code 1', 'code 2']);

            actual._sendWSWhenReady();

            expect(actual.sendWS.mock.calls.length).toBe(2);
            expect(actual.sendWS).toBeCalledWith('code 1');
            expect(actual.sendWS).toBeCalledWith('code 2');
            expect(actual._sendWhenReady).toBe(null);
        });
    });

    describe('sendWS()', () => {
        it('calls send() when the connection is ready', () => {
            const actual = new fujian.Fujian();
            actual.statusWS = () => WS_STATUS.OPEN;
            actual._fujian = { send: jest.genMockFn() };
            actual._sendWhenReady = null;  // pretend "onopen" already executed
            const code = 'some code';

            actual.sendWS(code);

            expect(actual._fujian.send).toBeCalledWith(code);
        });

        it('emits an error message when the connection is not ready', () => {
            const actual = new fujian.Fujian();
            actual.statusWS = () => WS_STATUS.CLOSED;
            actual._fujian = { send: jest.genMockFn() };
            actual._sendWhenReady = null;  // pretend "onopen" already executed
            const code = 'some code';

            actual.sendWS(code);

            expect(actual._fujian.send).not.toBeCalled();
            expect(log.error).toBeCalledWith(fujian.ERROR_MESSAGES.wsNotReady);
        });

        it('emits an error message when send() raises a SyntaxError', () => {
            const actual = new fujian.Fujian();
            actual.statusWS = () => WS_STATUS.OPEN;
            actual._fujian = { send: jest.genMockFn() };
            actual._sendWhenReady = null;  // pretend "onopen" already executed
            actual._fujian.send.mockImplementation(() => {
                throw new SyntaxError();
            });
            const code = 'some code';

            actual.sendWS(code);

            expect(actual._fujian.send).toBeCalledWith(code);
            expect(log.error).toBeCalledWith(fujian.ERROR_MESSAGES.wsSyntaxError);
        });

        it('enqueues messages for when the connection is ready', () => {
            const actual = new fujian.Fujian();
            actual.statusWS = () => WS_STATUS.OPEN;
            actual._fujian = { send: jest.genMockFn() };
            actual._sendWhenReady = Immutable.List();
            const code = 'some code';

            actual.sendWS(code);

            expect(actual._fujian.send).not.toBeCalled();
            expect(actual._sendWhenReady.get(0)).toBe(code);
        });
    });

    describe('_errorWS()', () => {
        it('sets a timeout to call startWS()', () => {
            const actual = new fujian.Fujian();
            actual._errorWS();
            expect(window.setTimeout).toBeCalledWith(actual.startWS, WS_RESTART_DELAY);
        });

        it('sets the WebSocket instance to "null"', () => {
            const actual = new fujian.Fujian();
            actual._errorWS();
            expect(actual._fujian).toBe(null);
        });

        it('does not overwrite _sendWhenReady if it already exists', () => {
            const actual = new fujian.Fujian();
            const expected = Immutable.List(['one', 'two', 'three']);
            actual._sendWhenReady = expected;
            actual._errorWS();
            expect(actual._sendWhenReady).toBe(expected);
        });

        it('calls log.error() when the connection was already initialized', () => {
            const actual = new fujian.Fujian();
            actual._sendWhenReady = null;
            actual._errorWS();
            expect(log.error).toBeCalledWith(fujian.ERROR_MESSAGES.websocketError);
        });

        it('creates a new List for _sendWhenReady, if it was null', () => {
            const actual = new fujian.Fujian();
            actual._sendWhenReady = null;
            actual._errorWS();
            expect(Immutable.List.isList(actual._sendWhenReady)).toBeTruthy();
        });
    });
});


describe('The response loading callbacks', () => {
    beforeEach(() => {
        log.error.mockClear();
        log.warn.mockClear();
        log.info.mockClear();
        log.debug.mockClear();
        //
        store.dispatch({ type: 'RESET' });
    });

    it('Fujian._receiveWS() calls _commonReceiver() correctly', () => {
        // mock _commonReceiver()
        const origCommonReceiver = fujian.Fujian._commonReceiver;
        fujian.Fujian._commonReceiver = jest.genMockFn();

        const event = { data: 'check it out!' };
        fujian.Fujian._receiveWS(event);
        expect(fujian.Fujian._commonReceiver).toBeCalledWith(event.data, false);

        // replace _commonReceiver() mock
        fujian.Fujian._commonReceiver = origCommonReceiver;
    });

    it('Fujian._loadAjax() calls _commonReceiver() correctly', () => {
        // mock _commonReceiver()
        const origCommonReceiver = fujian.Fujian._commonReceiver;
        fujian.Fujian._commonReceiver = jest.genMockFn();

        const event = { target: { response: 'check it out!' } };
        fujian.Fujian._loadAjax(event);
        expect(fujian.Fujian._commonReceiver).toBeCalledWith(event.target.response, true);

        // replace _commonReceiver() mock
        fujian.Fujian._commonReceiver = origCommonReceiver;
    });

    describe('_commonReceiver()', () => {
        it('works properly', () => {
            // In this test...
            // - doStdio=false (but becomes true because of the traceback)
            // - there are values for stdout, stderr, and return
            // - response.signal indicates "outbound.CONVERSION_ERROR"
            // - response.traceback has stuff in it
            const doStdio = false;
            const dataObj = {stdout: 'out', stderr: 'err', return: 'ret', traceback: 'back',
                signal: 'outbound.CONVERSION_ERROR'};
            const data = JSON.stringify(dataObj);
            const expectedStdout = `${dataObj.traceback}<br>${fujian.ERROR_MESSAGES.outboundConv}<br>${dataObj.stdout}<br>${dataObj.stderr}<br>`;

            fujian.Fujian._commonReceiver(data, doStdio);

            expect(log.info).toBeCalledWith(fujian.ERROR_MESSAGES.fjnRetVal);
            expect(log.info).toBeCalledWith(dataObj.return);
            const theStore = store.getState();
            expect(metaGetters.stdout(theStore)).toBe(expectedStdout);
            expect(uiGetters.modalType(theStore)).toBe('error');
            expect(uiGetters.modalMessage(theStore)).toBe('Unhandled Exception in Python');
        });

        it('ignores a signal that does not exist in Julius', () => {
            // In this test...
            // - doStdio=true and there is a value for stdout
            // - response.signals indicates "whatever.DOES_NOT_EXIST" (which just ensures nothing fails,
            //   and the function continues execution through the stdio part
            const doStdio = true;
            const dataObj = {stdout: 'out', signals: 'whatever.DOES_NOT_EXIST'};
            const data = JSON.stringify(dataObj);

            fujian.Fujian._commonReceiver(data, doStdio);

            const theStore = store.getState();
            expect(metaGetters.stdout(theStore)).toBe(`${dataObj.stdout}<br>`);
        });

        it('does not call stdout() signal if doStdio=true but there are no values to output', () => {
            // In this test...
            // - doStdio=true and there are no values for stdout, stderr, and return
            const doStdio = true;
            const dataObj = {};
            const data = JSON.stringify(dataObj);

            fujian.Fujian._commonReceiver(data, doStdio);

            const theStore = store.getState();
            expect(metaGetters.stdout(theStore)).toBe('');
        });

        it('does not call stdout() signal if doStdio=true and Fujian returns 0-length strings', () => {
            // In this test...
            // - doStdio=true and stdout, stderr, and return are zero-length strings
            const doStdio = true;
            const dataObj = {stdout: '', stderr: '', return: ''};
            const data = JSON.stringify(dataObj);

            fujian.Fujian._commonReceiver(data, doStdio);

            const theStore = store.getState();
            expect(metaGetters.stdout(theStore)).toBe('');
        });

        it('does not call stdout() signal if doStdio=false, even if there is stuff to print out', () => {
            // In this test...
            // - doStdio=false and there are values for stdout, stderr, and return
            // - response.traceback is a zero-length string
            const doStdio = false;
            const dataObj = {stdout: 'out', stderr: 'err', return: 'ret', traceback: ''};
            const data = JSON.stringify(dataObj);

            fujian.Fujian._commonReceiver(data, doStdio);

            const theStore = store.getState();
            expect(metaGetters.stdout(theStore)).toBe('');
        });

        it('does call stdout() if doStdio=false but LOG_LEVEL===DEBUG', () => {
            // In this test...
            // - LOG_LEVEL is DEBUG
            // - doStdio is false
            // - there are values for stdout, stderr, and return
            // - response.traceback is a zero-length string
            const doStdio = false;
            const dataObj = {stdout: 'out', stderr: 'err', return: 'ret', traceback: ''};
            const data = JSON.stringify(dataObj);
            metaActions.setLogLevel(LOG_LEVELS.DEBUG);
            const expStdout = `${dataObj.stdout}<br>${dataObj.stderr}<br>`;

            fujian.Fujian._commonReceiver(data, doStdio);

            const theStore = store.getState();
            expect(metaGetters.stdout(theStore)).toBe(expStdout);
        });

        it('calls log.error() when "data" contains invalid JSON', () => {
            const doStdio = false;
            const data = '{key: value';
            fujian.Fujian._commonReceiver(data, doStdio);
            expect(log.error).toBeCalledWith(fujian.ERROR_MESSAGES.fjnBadJson);
        });
    });
});


describe('The error and abort callbacks', () => {
    beforeEach(() => { log.error.mockClear(); });

    it('Fujian._abortAjax() calls log.error() with the stuff', () => {
        const event = 5;
        fujian.Fujian._abortAjax(event);
        expect(log.error.mock.calls.length).toBe(2);
        expect(log.error).toBeCalledWith(fujian.ERROR_MESSAGES.ajaxAbort);
        expect(log.error).toBeCalledWith(event);
    });

    it('Fujian._errorAjax() calls log.error() with the stuff', () => {
        const event = 5;
        fujian.Fujian._errorAjax(event);
        expect(log.error.mock.calls.length).toBe(2);
        expect(log.error).toBeCalledWith(fujian.ERROR_MESSAGES.ajaxError);
        expect(log.error).toBeCalledWith(event);
    });
});
