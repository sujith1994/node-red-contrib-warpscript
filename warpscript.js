//
//   Copyright 2019  SenX S.A.S.
//
//   Licensed under the Apache License, Version 2.0 (the "License");
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
//   Unless required by applicable law or agreed to in writing, software
//   distributed under the License is distributed on an "AS IS" BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
//   limitations under the License.
//
const urllib = require('url');
const https = require('https');
const http = require('http');

module.exports = function(RED) {

    /**
     *
     * @param config
     * @constructor
     */
    function WarpScriptNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        this.warpurl = config.warpurl;
        this.warpscript = config.warpscript;

        this.on('input', function(msg) {
            //
            // Create the representation of the message
            //

            console.log("testting the code");
            //            console.log(msg);

            let postData = '{ ';

            for (let key in msg) {

                if (key === "_msgid") {
                    const parsed = parse(msg[key]);
                    if (undefined !== parsed) {
                        postData += ` '${key.toString()}' ${parsed}`;
                    }
                } else if (key === "payload") {

                    const parsed = parse(msg[key]);
                    if (undefined !== parsed) {
                        postData += ` '${key.toString()}' ${parsed}`;
                    }
                }
            }
            console.log(msg.script);

            postData += '}\n' + msg.script;
            console.log(postData);

            const opts = urllib.parse(this.warpurl);
            const post_options = {
                host: opts.hostname,
                port: opts.port,
                path: opts.path,
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            // Set up the response handling

            let data = '';
            const post_req = ((/^https/.test(this.warpurl)) ? https : http).request(post_options, res => {
                res.setEncoding('utf8');
                res.on('data', chunk => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode < 400) {
                        node.status({ fill: "green", shape: "dot", text: '' });
                        //
                        // parse the JSON returned by Warp 10™ and reverse it so the most recent element is last
                        //
                        try {

                            const json = JSON.parse(data).reverse();
                            //console.log(json);
                            const output = [];
                            //msg = {}
                            msg.payload = json;
                            output.push(msg);


                            //json.forEach(message => {
                            // if (Array.isArray(message)) {
                            //      console.log("call is in array")
                            //  output.push(message);
                            // } else if (typeof message == 'object') {
                            //      console.log("call is in object");
                            //  output.push(message);
                            // } else {
                            //
                            // Wrap the element in an object
                            //
                            //   msg = {};
                            // msg.payload = message;
                            //output.push(msg);
                            //output.push(message);
                            // }
                            //});

                            //
                            // Emit the output messages
                            //
                            output.forEach(msg => {
                                node.send(msg);
                            });
                        } catch (err) {
                            node.error(err, msg);
                            node.status({ fill: 'red', shape: "ring", text: 'Error' });
                        }
                    } else {
                        const err = res.headers['x-warp10-error-message'] || 'Something wrong appends';
                        node.error(err, msg);
                        msg.payload = `${err}: ${this.warpurl}`;
                        msg.statusCode = res.statusCode;
                        node.send(msg);
                        node.status({ fill: "red", shape: "ring", text: res.statusCode });
                    }
                });
            });

            post_req.on('error', err => {
                node.error(err, msg);
                msg.payload = `${err.toString()}: ${this.warpurl}`;
                msg.statusCode = err.code;
                node.send(msg);
                node.status({ fill: 'red', shape: "ring", text: err.code });
            });

            //
            // do the actual HTTP call
            //
            post_req.write(postData);
            post_req.end();
        });
    }

    //
    // Parse an element and output its WarpScript™ representation
    //

    function parse(currentData) {

        if (typeof currentData === 'string') {
            return `'${currentData.toString()}' `;
        }

        if (typeof currentData === 'number' || typeof currentData === 'boolean') {
            return `${currentData.toString()} `;
        }

        // noinspection JSTypeOfValues
        if (typeof currentData === 'Buffer') {
            return `'${currentData.toString('utf-8')}' `;
        }

        if (Array.isArray(currentData)) {
            let array = '[ ';
            currentData.forEach(elt => array += parse(elt));
            array += '] ';
            return array;
        }

        if (typeof currentData === 'object') {
            if (null === currentData) {
                return 'NULL ';
            }
            let obj = '{ ';
            currentData.forEach((subItem, keyItem) => {
                obj += `'${keyItem.toString()}' ${parse(subItem)}`;
            });
            obj += '} ';
            return obj;
        }

        return undefined;
    }

    RED.nodes.registerType(`WarpScript`, WarpScriptNode);
};