#!/usr/bin/python3

# Gives the translation status of the specified apps and languages.
#
# Copyright 2013 Google Inc.
# https://developers.google.com/blockly/
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Extracts messages from .js files into .json files for translation.

Specifically, lines with the following formats are extracted:

    /// Here is a description of the following message.
    Blockly.SOME_KEY = 'Some value';

Adjacent "///" lines are concatenated.

There are two output files, each of which is proper JSON.  For each key, the
file en.json would get an entry of the form:

    "Blockly.SOME_KEY", "Some value",

The file qqq.json would get:

    "Blockly.SOME_KEY", "Here is a description of the following message.",

Commas would of course be omitted for the final entry of each value.

@author Ellen Spertus (ellen.spertus@gmail.com)
"""

import argparse
import codecs
import json
import os
import re
from common import write_files


_INPUT_DEF_PATTERN = re.compile("""Blockly.Msg.(\w*)\s*=\s*'(.*)';?\r?$""")

_INPUT_SYN_PATTERN = re.compile("""Blockly.Msg.(\w*)\s*=\s*Blockly.Msg.(\w*);""")

_CONSTANT_DESCRIPTION_PATTERN = re.compile("""{{Notranslate}}""", re.IGNORECASE)


def main():
    # Set up argument parser.
    parser = argparse.ArgumentParser(description="Create translation files.")
    parser.add_argument(
        "--author",
        default="Ellen Spertus <ellen.spertus@gmail.com>",
        help="name and email address of contact for translators",
    )
    parser.add_argument("--lang", default="en", help="ISO 639-1 source language code")
    parser.add_argument(
        "--output_dir", default="json", help="relative directory for output files"
    )
    parser.add_argument("--input_file", default="messages.js", help="input file")
    parser.add_argument(
        "--quiet",
        action="store_true",
        default=False,
        help="only display warnings, not routine info",
    )
    args = parser.parse_args()
    if not args.output_dir.endswith(os.path.sep):
        args.output_dir += os.path.sep

    # Read and parse input file.
    results = []
    synonyms = {}
    constants = {}  # Values that are constant across all languages.
    description = ""
    infile = codecs.open(args.input_file, "r", "utf-8")
    result = {}
    result["meaning"] = ""
    for line in infile:
        if line.startswith("///"):
            if description:
                description = description + " " + line[3:].strip()
            else:
                description = line[3:].strip()
        else:
            match = _INPUT_DEF_PATTERN.match(line)
            if match:
                key = match.group(1)
                value = match.group(2).replace("\\'", "'")
                if not description:
                    print("Warning: No description for " + result["meaning"])
                if description and _CONSTANT_DESCRIPTION_PATTERN.search(description):
                    constants[key] = value
                else:
                    result = {}
                    result["meaning"] = key
                    result["source"] = value
                    result["description"] = description
                    results.append(result)
                description = ""
            else:
                match = _INPUT_SYN_PATTERN.match(line)
                if match:
                    if description:
                        print(
                            "Warning: Description preceding definition of synonym {0}.".format(
                                match.group(1)
                            )
                        )
                        description = ""
                    synonyms[match.group(1)] = match.group(2)
    infile.close()

    # Create <lang_file>.json, keys.json, and qqq.json.
    write_files(args.author, args.lang, args.output_dir, results, False)

    # Create synonyms.json.
    synonym_file_name = os.path.join(os.curdir, args.output_dir, "synonyms.json")
    with open(synonym_file_name, "w") as outfile:
        json.dump(synonyms, outfile)
    if not args.quiet:
        print(
            "Wrote {0} synonym pairs to {1}.".format(len(synonyms), synonym_file_name)
        )

    # Create constants.json
    constants_file_name = os.path.join(os.curdir, args.output_dir, "constants.json")
    with open(constants_file_name, "w") as outfile:
        json.dump(constants, outfile)
    if not args.quiet:
        print(
            "Wrote {0} constant pairs to {1}.".format(len(constants), synonym_file_name)
        )


if __name__ == "__main__":
    main()
