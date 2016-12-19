// -*- coding: utf-8 -*-
// ------------------------------------------------------------------------------------------------
// Program Name:           Julius
// Program Description:    User interface for the nCoda music notation editor.
//
// Filename:               js/nuclear/signals.js
// Purpose:                NuclearJS Actions and ActionTypes.
//
// Copyright (C) 2016 Christopher Antila
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

// Note: This module is called "signals" so that nCoda has a consistent relationship between its
//       Python and JavaScript worlds. In JavaScript, our NuclearJS "actionTypes" are effectively
//       the names of signals, and "actions" are effectively the signals' "emit" functions.
//

import {Immutable} from 'nuclear-js';

import {getters} from './getters';
import {log} from '../util/log';
import reactor from './reactor';
import {fujian} from '../util/fujian';

import store from '../stores';
import { getters as docGetters } from '../stores/document';


// "names" is NuclearJS "actionTypes."
const names = {
    // Verovio
    ADD_NEW_VIDAVIEW: 'ADD_NEW_VIDAVIEW',
    DESTROY_VIDAVIEW: 'DESTROY_VIDAVIEW',
    RENDER_TO_VEROVIO: 'RENDER_TO_VEROVIO',
    // Fujian PyPy Server (currently doesn't affect NuclearJS)
    FUJIAN_START_WS: 'FUJIAN_START_WS',
    FUJIAN_RESTAT_WS: 'FUJIAN_RESTAT_WS',
    FUJIAN_CLOSE_WS: 'FUJIAN_CLOSE_WS',
};


// "emitters" is NuclearJS "actions."
const emitters = {
    // Verovio
    addNewVidaView(parentElement, sectID) {
        reactor.dispatch(names.ADD_NEW_VIDAVIEW, {parentElement, sectID});
    },
    destroyVidaView(sectID) {
        reactor.dispatch(names.DESTROY_VIDAVIEW, {sectID});
    },
    renderToVerovio(mei) {
        reactor.dispatch(names.RENDER_TO_VEROVIO, mei);
    },

    // Fujian PyPy Server (currently doesn't affect NuclearJS)
    fujianStartWS() {
        fujian.startWS();
    },
    fujianRestartWS() {
        fujian.stopWS();
        fujian.startWS();
    },
    fujianStopWS() {
        fujian.stopWS();
    },
    /** lyInitializeSession(): Initialize a session management object in Lychee.
     *
     * Runs this code:
     * >>> import lychee
     * >>> _JULIUS_SESSION = lychee.workflow.session.InteractiveSession()
     *
     * NB: the "ly" prefix is for signals doing something with Lychee
     */
    lyInitializeSession() {
        fujian.sendWS(
`if 'lychee' not in globals():
    import lychee
if '_JULIUS_SESSION' not in globals():
    import lychee.workflow.session
    _JULIUS_SESSION = lychee.workflow.session.InteractiveSession()\n`
        );
    },
    /** lyGetSectionById(): Run the outbound steps to get MEI data for a specific section.
     *
     * Parameters:
     * -----------
     * @param {string} sectId - The @xml:id value of the <section> to request.
     * @param {string} revision - Optional changeset identifier if you wish to receive "historical"
     *     data from the document.
     */
    lyGetSectionById(sectId, revision) {
        if (revision) {
            fujian.sendWS(
                `lychee.signals.ACTION_START.emit(views_info="${sectId}", revision="${revision}")\n`
            );
        }
        else {
            fujian.sendWS(
                `lychee.signals.ACTION_START.emit(views_info="${sectId}")\n`
            );
        }
    },
    submitToLychee(data, format) {
        // Given some "data" and a "format," send the data to Lychee via Fujian as an update to the
        // currently-active score/section.
        //
        // Parameters:
        // - data (string) Data to submit to Lychee.
        // - format (string) The string "lilypond".
        //

        if ('string' !== typeof data) {
            log.error('submitToLychee() received a "data" argument that is not a string.');
            return;
        }

        if ('lilypond' === format) {
            // First check there is no """ in the string, which would cause the string to terminate
            // early and allow executing arbitrary code.
            if (-1 === data.indexOf('"""')) {
                // find the @xml:id
                const xmlid = docGetters.cursor(store.getState()).last();
                // make sure all the "\" chars are escaped
                data = data.replace(/\\/g, '\\\\');
                // put the Python command around it
                const code = `import lychee\nlychee.signals.ACTION_START.emit(dtype='LilyPond', doc="""${data}""", views_info="${xmlid}")`;
                fujian.sendWS(code);
            }
            else {
                log.error('Invalid LilyPond code. Please do not use """ in your LilyPond code.');
            }
        }
        else if ('mei' === format) {
            // Prolly gonna crash, but YOLO.
            log.info(`submitToLychee() was called with MEI data, but that's not implemented yet!`);
            // const code = `import lychee\nlychee.signals.ACTION_START.emit(dtype='MEI', doc="""${data}""")`;
            // fujian.sendWS(code);
        }
        else {
            log.error('submitToLychee() received an unknown "format" argument.');
        }
    },
    submitToPyPy(code) {
        // For code being submitted by the human user.
        //
        fujian.sendAjax(code);
    },

    // Registering outbound formats with Lychee
    _regOutboundFormat(direction, dtype, who, extra) {
        // You must call this through registerOutboundFormat() or unregisterOutboundFormat().
        // --> the "extra" param is just a string where you can put stuff for an extra argument to the signal
        //
        if ('string' !== typeof dtype) {
            const msg = `Calling ${direction}_FORMAT requires a string for "dtype".`;
            log.warn(msg);
            return;
        }

        if (!extra) {
            extra = '';
        }

        dtype = `'${dtype}'`;
        if ('string' === typeof who) {
            who = `'${who}'`;
        }
        else {
            who = 'None';
        }
        const code = `import lychee\nlychee.signals.outbound.${direction}_FORMAT.emit(dtype=${dtype}, who=${who}${extra})`;
        fujian.sendWS(code);
    },
    /** Emit Lychee's "outbound.REGISTER_FORMAT" signal.
     *
     * @param {str} dtype - Which dtype to register for outbound conversion.
     * @param {str} who - An identifier for the component requiring the registration.
     * @param {bool} outbound - Whether to run the "outbound" conversion immediately, producing
     *     data in this format without requiring a change in the document.
     */
    registerOutboundFormat(dtype, who, outbound) {
        if (outbound) {
            emitters._regOutboundFormat('REGISTER', dtype, who, ', outbound=True');
        }
        else {
            emitters._regOutboundFormat('REGISTER', dtype, who);
        }
    },
    /** Emit Lychee's "outbound.UNREGISTER_FORMAT" signal.
     *
     * @param {str} dtype - Which dtype to unregister.
     * @param {str} who - The "who" argument provided on registration.
     */
    unregisterOutboundFormat(dtype, who) {
        emitters._regOutboundFormat('UNREGISTER', dtype, who);
    },

    /** Change the repository directory.
     *
     * @param {string} path - Pathname to use for the repository.
     *
     * This is equivalent to "opening" an existing project, or creating a new one. This does *not*
     * move an existing repository directory.
     */
    lySetRepoDir(path) {
        if (path.indexOf(';') > -1 || path.indexOf(')') > -1 || path.indexOf("'") > -1) {
            // TODO: blacklisting like this isn't sufficient
            log.error('The pathname is invalid');
        }
        else {
            const code =
`if _JULIUS_SESSION:
    _JULIUS_SESSION.set_repo_dir('${path}', run_outbound=True)
else:
    raise RuntimeError('you set repo dir before you made a _JULIUS_SESSION')
`;
            fujian.sendWS(code);
        }
    },
    /** Load the default demo repository.'
     */
    lyLoadDefaultRepo() {
        const code =
`if _JULIUS_SESSION:
    _JULIUS_SESSION.set_repo_dir('programs/hgdemo')
    lychee.signals.ACTION_START.emit()
else:
    raise RuntimeError('you set repo dir before you made a _JULIUS_SESSION')
`;
        fujian.sendWS(code);
    },
};


const signals = {names: names, emitters: emitters};
export {signals, names, emitters};
export default signals;
