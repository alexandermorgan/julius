// -*- coding: utf-8 -*-
// ------------------------------------------------------------------------------------------------
// Program Name:           Julius
// Program Description:    User interface for the nCoda music notation editor.
//
// Filename:               js/react/code_score_view.js
// Purpose:                React components for CodeScoreView.
//
// Copyright (C) 2015 Wei Gao
// Copyright (C) 2016 Christopher Antila, Sienna M. Wood
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

import React from 'react';

import ReactCodeMirror from './CodeMirror';
import {Button, ButtonGroup} from 'amazeui-react';
import SplitPane from '../../node_modules/react-split-pane/lib/SplitPane';
import CustomScrollbars from './custom_scrollbars';
import {IconPython, IconLilypond} from './svg_icons';

import getters from '../nuclear/getters';
import reactor from '../nuclear/reactor';
import signals from '../nuclear/signals';


const TextEditor = React.createClass({
    propTypes: {
        submitToLychee: React.PropTypes.func.isRequired,
        submitToPyPy: React.PropTypes.func.isRequired,
    },
    getInitialState() {
        return {editorValue: ''};
    },
    handleEditorChange(withThis) {
        // TODO: is this too much re-rendering? To be going through TextEditor with "state" on every single key press?
        this.setState({editorValue: withThis});
    },
    handleSubmitPython() {
        this.props.submitToPyPy(this.state.editorValue);
    },
    handleSubmitLilyPond() {
        this.props.submitToLychee(this.state.editorValue, 'lilypond');
    },
    render() {
        const codeMirrorOptions = {
            mode: "python",
            theme: "codemirror-ncoda light",
            indentUnit: 4,
            indentWithTabs: false,
            smartIndent: true,
            electricChars: true,
            lineNumbers: true,
            autofocus: true,
            lineWrapping: true,
            scrollbarStyle: "native",
            inputStyle: "contenteditable",  // NOTE: this usually defaults to "textarea" on
                                            // desktop and may not be so good for us, but it has
                                            // better IME and and screen reader support
        };
        return (
            <div>
                <div className="pane-head">
                    <h2>{`Text Editor`}</h2>
                    <div className="ncoda-text-editor-controls">
                        <ButtonGroup>
                            <Button title="Run as Python" className="am-btn-xs" onClick={this.handleSubmitPython}>
                                <IconPython />
                            </Button>
                            <Button title="Submit as Lilypond" className="am-btn-xs" onClick={this.handleSubmitLilyPond}>
                                <IconLilypond />
                            </Button>
                        </ButtonGroup>
                    </div>
                </div>
                <CustomScrollbars>
                    <ReactCodeMirror
                        path="ncoda-editor"
                        options={codeMirrorOptions}
                        value={this.state.editorValue}
                        onChange={this.handleEditorChange}
                    />
                </CustomScrollbars>
            </div>
        );
    },
});


const Verovio = React.createClass({
    //
    // State
    // =====
    // - meiForVerovio
    // - renderedMei
    // - verovio
    //

    mixins: [reactor.ReactMixin],
    getDataBindings() {
        return {meiForVerovio: getters.meiForVerovio};
    },
    getInitialState() {
        // - verovio: the instance of Verovio Toolkit
        // - renderedMei: the current SVG score as a string
        // - meiForVerovio: do NOT set in this function (set by the ReactMixin)
        return {verovio: null, renderedMei: ''};
    },
    componentWillMount() {
        signals.emitters.registerOutboundFormat('verovio', 'Verovio component', true);
    },
    componentWillUnmount() {
        signals.emitters.unregisterOutboundFormat('verovio', 'Verovio component');
        delete this.state.verovio;
    },
    render() {
        signals.emitters.loadMEI(this.state.meiForVerovio);
        return (
            <div className="ncoda-verovio" ref="verovioFrame"></div> 
        );
    },
    componentDidMount() {
        signals.emitters.initializeVida({
            'parentElement': document.querySelector('.ncoda-verovio'),
            'workerLocation': '/js/lib/verovioWorker.js',
            'verovioLocation': '/js/verovio-toolkit-0.9.9.js'
        });
    }
});


const WorkTable = React.createClass({
    propTypes: {
        meiForVerovio: React.PropTypes.string,
        submitToLychee: React.PropTypes.func.isRequired,
        submitToPyPy: React.PropTypes.func.isRequired,
    },
    getDefaultProps() {
        return {meiForVerovio: ''};
    },
    render() {
        return (
            <SplitPane split="vertical"
                       ref="workTable"
                       className="ncoda-work-table"
                       primary="second"
                       minSize="20"
                       defaultSize="60%">
                <div className="ncoda-text-editor pane-container">
                    <TextEditor
                        ref="textEditor"
                        submitToPyPy={this.props.submitToPyPy}
                        submitToLychee={this.props.submitToLychee}
                    />
                </div>
                <div className="ncoda-verovio pane-container">
                    <CustomScrollbars>
                        <Verovio ref="verovio" meiForVerovio={this.props.meiForVerovio} />
                    </CustomScrollbars>
                </div>
            </SplitPane>
        );
    },
});


const TerminalWindow = React.createClass({
    propTypes: {
        extraClass: React.PropTypes.string,
        outputThis: React.PropTypes.string,
    },
    getDefaultProps() {
        return {outputThis: '', extraClass: ''};
    },
    formatString(outputThis) {
        // Formats a string properly so it can be outputted in the window as dangerouslySetInnerHTML.
        //
        let post = outputThis;

        // TODO: how to make this replace all occurrences?
        // TODO: how to avoid other possible attacks?
        while (post.includes('<')) {
            post = post.replace('<', '&lt;');
        }
        while (post.includes('>')) {
            post = post.replace('>', '&gt;');
        }

        // convert newlines to <br/>
        while (post.includes('\n')) {
            post = post.replace('\n', '<br/>');
        }

        // finally append our thing
        if (!post.endsWith('<br/>')) {
            post += '<br/>';
        }
        // wrap the output in <pre> tag to preserve spaces and tabs.
        post = `<pre>${post}</pre>`;
        return post;
    },
    render() {
        const innerHtml = {__html: this.formatString(this.props.outputThis)};
        let className = 'ncoda-terminal-window';
        if (this.props.extraClass.length > 0) {
            className += `${className} ${this.props.extraClass}`;
        }
        return (
            <div className={className} dangerouslySetInnerHTML={innerHtml}></div>
        );
    },
});


const TerminalOutput = React.createClass({
    // NOTE: if the output isn't changing, you can use ``null`` for props.outputType
    mixins: [reactor.ReactMixin],
    getDataBindings() {
        return {stdout: getters.stdout, stderr: getters.stderr, stdin: getters.stdin};
    },
    render() {
        return (
            <SplitPane split="vertical"
                       id="ncoda-terminal-output"
                       className="ncoda-terminal-output"
                       primary="second"
                       minSize="20"
                       defaultSize="50%">
                <div className="pane-container">
                    <div className="pane-head">
                        <h2>{`Your Input`}</h2>
                    </div>
                    <CustomScrollbars>
                        <TerminalWindow outputThis={this.state.stdin}/>
                    </CustomScrollbars>
                </div>
                <div className="pane-container">
                    <div className="pane-head">
                        <h2>{`Python Output`}</h2>
                    </div>
                    <CustomScrollbars>
                        <TerminalWindow outputThis={this.state.stdout}/>
                    </CustomScrollbars>
                </div>
            </SplitPane>
        );
    },
});

const CodeScoreView = React.createClass({
    propTypes: {
        meiForVerovio: React.PropTypes.string,
    },
    getDefaultProps() {
        return {meiForVerovio: '', sendToConsole: '', sendToConsoleType: null};
    },
    getInitialState() {
        return {
            sendToConsole: 'nCoda is ready for action!',
            sendToConsoleType: 'welcome',
        };
    },
    render() {
        return (
            <div id="nc-csv-frame">
                <SplitPane split="horizontal" minSize="20" defaultSize="70%">
                    <WorkTable
                        ref="workTable"
                        submitToPyPy={signals.emitters.submitToPyPy}
                        submitToLychee={signals.emitters.submitToLychee}
                        meiForVerovio={this.props.meiForVerovio}
                    />
                    <TerminalOutput ref="terminalOutput"/>
                </SplitPane>
            </div>
        );
    },
});


export default CodeScoreView;
