const fs = require("fs/promises");
const fsn = require("fs");
const path = require('path');
const { mdToPdf } = require("md-to-pdf");
const glob = require("glob");
const { title } = require("process");

/**
 * Convert title to slug.
 * From: https://gist.github.com/codeguy/6684588?permalink_comment_id=3426313#gistcomment-3426313
 * @param {string} title The title to convert to a slug.
 * @returns {string}
 */
const toSlug = title => title
    .replace(/[^a-zA-Z0-9_ ]/g, '') // Remove all chars not letters, numbers and spaces (to be replaced)
    .replace(/\s+/g, "_")

/**
 * Gets all notes in the keep directory.
 * @returns {Promise<Array<string>>}
 */
const getNotes = async () => new Promise((resolve, reject) => {
    glob("./keep/*.json", (error, files) => {
        if (error) {
            reject(error);
        }
        resolve(files);
    });
});

/**
 * Open the note JSON file.
 * @param {string} npath The path of the JSON note.
 * @returns {Priomise<Object>}
 */
const openNote = async npath => {
    const data = await fs.readFile(npath, { encoding: "utf8" });
    return JSON.parse(data);
};

/**
 * Parse the data out of the note's JSON object to use for markdown.
 * @param {string} npath The path of the JSON note.
 * @param {Object} note The note's JSON.
 * @returns {Object}
 */
const parseNote = (npath, note) => {
    // Note contents
    let noteContent = note.textContent;

    // Title is sometimes undefined, fallback to note's filename if so
    const noteTitle = note.title || path.basename(npath).replace(".json", "");

    // Most of my notes have a "Source: (url)" at the bottom... try to extract it
    const source = noteContent.match(/Source:\s+(?<path>.*)/i);
    let noteSource = source ? source.groups.path : null;
    if (noteSource === null) {
        // Not defined, try annotations
        noteSource = "annotations" in note
            ? note.annotations.map(a => a.url).join(", ")
            : "N/A";
    } else {
        // Strip the source if it is inside the note
        noteContent = noteContent.replace(/Source:\s+(.*)/i, "");
    }

    // Check if content has a title heading
    const heading = noteContent.split("\n").slice(0, 3).join().match(/# (.*)/);
    const noteHeading = heading ? true : noteTitle;

    // Append labels to the content
    const noteLabels = (note.labels || []).map(label => label.name).join(", ");

    return {
        title: noteTitle,
        heading: noteHeading,
        content: noteContent,
        source: noteSource,
        labels: noteLabels,
        filename: toSlug(noteTitle),
    };
};

/**
 * Convert note to a PDF.
 * @param {string} filename The filename for the PDF. 
 * @param {string} content The content of the note.
 * @returns {Promise<void>}
 */
const noteToPdf = async (filename, content) =>
    mdToPdf(
        { content },
        {
            dest: `./generated/${filename}.pdf`,
            pdf_options: { timeout: 0 },
        },
    );

/**
 * Save content of note to Markdown (does not convert, assumes Markdown already).
 * @param {string} filename The filename for the Markdown file. 
 * @param {string} content The content of the note. 
 * @returns {Promise<void>}
 */
const noteSaveToMd = async (filename, content) =>
    fs.writeFile(`./generated/${filename}.md`, content);

/**
 * Reformats the note.
 * @param {Object} note The parsed note.
 * @returns {string}
 */
const notePdfTpl = note => {
    const { heading, content, source, labels } = note;

    let tpl = heading !== true ? `# ${heading}\n\n` : "";
    tpl += `${content}\n\n----\nSource: ${source}\n\nLabels: ${labels}`;
    return tpl;
};

/**
 * Get the already-processed list of notes.
 * @returns {Promise<Array<string>>}
 */
const getProcessed = async () => {
    if (!fsn.existsSync("./processed.txt")) {
        // Fresh
        return [];
    }

    // Exists... extract the list to an array of filenames
    const contents = await fs.readFile("./processed.txt", { encoding: "utf8" });
    return contents.split("\n");
};

/**
 * Update the already-processed notes.
 * @param {Array<string>} processed - The processed list.
 * @returns {Promise<void>}
 */
const updateProcessed = async processed =>
    fs.writeFile("./processed.txt", processed.join("\n"), { encoding: "utf8", flag: "w" });

/**
 * Main function.
 * @returns {Promise<void>}
 */
const main = async () => {
    // Get the already-processed notes
    const processed = await getProcessed();

    // Loop all notes
    let count = 0;
    const notes = await getNotes();
    for (let i = 0, n = notes.length; i < n; i += 1) {
        const npath = notes[i];
        if (!processed.includes(npath)) {
            console.log(`>> Processing "${npath}"...`);

            try {
                // Open and parse the note, convert it to a pdf
                const note = await openNote(npath);
                const pnote = parseNote(npath, note);
                const tpl = notePdfTpl(pnote);
                await noteToPdf(pnote.filename, tpl);
                await noteSaveToMd(pnote.filename, pnote.content);

                processed.push(npath);
                count += 1;
            } catch (e) {
                console.log(`>> Error "${npath}"...\n\tMessage: "${e.message}"`);
            }
        } else {
            console.log(`>> Skipping "${npath}"...`);
        }
    }

    // Update the processed file
    updateProcessed(processed);
    console.log(`Completed! Processed ${count} notes`);
    process.exit(0);
};

if (require.main === module) {
  main();
}
