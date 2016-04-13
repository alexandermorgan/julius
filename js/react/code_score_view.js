// -*- coding: utf-8 -*-
// ------------------------------------------------------------------------------------------------
// Program Name:           Julius
// Program Description:    User interface for the nCoda music notation editor.
//
// Filename:               js/react/code_score_view.js
// Purpose:                React components for CodeScoreView.
//
// Copyright (C) 2015 Wei Gao
// Copyright (C) 2016 Christopher Antila, Sienna M. Wood, Andrew Horwitz
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

import CodeMirror from './codemirror';
import {Button, ButtonGroup} from 'amazeui-react';
import SplitPane from '../../node_modules/react-split-pane/lib/SplitPane';
import CustomScrollbars from './custom_scrollbars';
import {IconPython, IconLilypond} from './svg_icons';
import {createNewVidaView, vidaController} from '../nuclear/stores/verovio';

import getters from '../nuclear/getters';
import reactor from '../nuclear/reactor';
import signals from '../nuclear/signals';

import {log} from '../util/log';


const TextEditor = React.createClass({
    propTypes: {
        submitToLychee: React.PropTypes.func.isRequired,
        submitToPyPy: React.PropTypes.func.isRequired,
    },
    getInitialState() {
        return {editorValue: ''};
    },
    shouldComponentUpdate(nextProps) {
        if (nextProps !== this.props) {
            return true;
        }
        return false;
    },
    handleEditorChange(withThis) {
        this.setState({editorValue: withThis});
    },
    handleSubmitPython() {
        this.props.submitToPyPy(this.state.editorValue);
    },
    handleSubmitLilyPond() {
        this.props.submitToLychee(this.state.editorValue, 'lilypond');
    },
    render() {
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
                    <CodeMirror onChange={this.handleEditorChange}/>
                </CustomScrollbars>
            </div>
        );
    },
});


/** Verovio: a React container for Vida6.
 *
 * Props:
 * ------
 * @param {str} sectId: The @xml:id attribute of the <section> to display.
 *
 * NOTE: this component does not update in the usual React way because it is a React wrapper around
 *       Vida6. The data rendered by Vida6 is managed in the "verovio" NuclearJS Store file.
 */
const Verovio = React.createClass({
    propTypes: {
        sectId: React.PropTypes.string.isRequired,
    },
    mixins: [reactor.ReactMixin],
    getDataBindings() {
        return {meiForVerovio: getters.meiForVerovio};
    },
    componentWillMount() {
        signals.emitters.registerOutboundFormat('verovio', 'Verovio component');
        signals.emitters.lyGetSectionById(this.props.sectId);
    },
    componentDidMount() { // Create the vidaView
        signals.emitters.addNewVidaView(this.refs.verovioFrame, this.props.sectId);
    },
    componentWillReceiveProps(nextProps) {
        if (this.props.sectId !== nextProps.sectId) {
            signals.emitters.destroyVidaView(this.props.sectId);
        }
    },
    shouldComponentUpdate(nextProps, nextState) {
        // if the sectIds don't line up, we want to re-render
        if (this.props.sectId !== nextProps.sectId) {
            return true;
        }
        return false;
    },
    componentDidUpdate() { // Create the vidaView
        signals.emitters.addNewVidaView(this.refs.verovioFrame, this.props.sectId);
    },
    componentWillUnmount() {
        signals.emitters.unregisterOutboundFormat('verovio', 'Verovio component');
        signals.emitters.destroyVidaView(this.props.sectId);
    },
    render() {
        return <div className="ncoda-verovio" ref="verovioFrame"/>;
    },
});


const WorkTable = React.createClass({
    propTypes: {
        submitToLychee: React.PropTypes.func.isRequired,
        submitToPyPy: React.PropTypes.func.isRequired,
    },
    mixins: [reactor.ReactMixin],
    getDataBindings() {
        return {sectionCursor: getters.sectionCursor};
    },
    render() {
        const sectId = this.state.sectionCursor.last() || 'Sme-s-m-l-e8726689';
        if (!this.state.sectionCursor.last()) {
            log.debug('Document cursor is not set; using default section');
        }
        return (
            <SplitPane split="vertical"
                       className="ncoda-work-table"
                       primary="second"
                       minSize="20"
                       defaultSize="60%">
                <div className="ncoda-text-editor pane-container">
                    <TextEditor
                        submitToPyPy={this.props.submitToPyPy}
                        submitToLychee={this.props.submitToLychee}
                    />
                </div>
                <div className="ncoda-verovio pane-container">
                    <CustomScrollbars>
                        <Verovio sectId={sectId}/>
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
