const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/app/00-storage-sync-patches.js'), 'utf8');
const start = source.indexOf('async function assessNeatnessFromImage(');
const end = source.indexOf('/* =============================================', start);
assert.ok(start >= 0 && end > start);
const labels = ['Letter Formation', 'Spacing', 'Staying on the Line', 'Size Consistency', 'Pen Control and Marks', 'Page Layout and Paragraphs'];
function response(scores, overall = 'Missing', sourceType = 'HANDWRITTEN') {
    return '**Source Type:** ' + sourceType + '\n**Source Type Reason:** Test source reason.\n'
        + labels.map((label, i) => scores[i] === undefined ? '' : '- ' + label + ': ' + scores[i] + '/5').join('\n')
        + '\n- Neatness: ' + overall + '/10 - Test observation.\n**Neatness Growth Tip:** Leave clearer spaces.';
}
async function assess(text) {
    const app = vm.runInNewContext(source.slice(start, end) + '\n;globalThis', {
        callOpenRouterImage: async (model, prompt, image) => {
            assert.equal(model, 'test-model'); assert.equal(image, 'cropped-image');
            assert.match(prompt, /Missing rather than guessing/);
            return text;
        }, wftDebugError() {}
    });
    return app.assessNeatnessFromImage('cropped-image', 'test-model');
}
(async () => {
    const missing = await assess(response(Array(6).fill('Missing')));
    assert.equal(missing.quickRubric.score, null, 'Missing criteria must not become zero and produce a 2/10 grade');
    assert.equal(missing.quickRubric.neatnessWeightedFive, null);
    assert.equal(missing.quickRubric.neatnessScoreFive, null);
    for (const scores of [[4, 4, 'Missing', 4, 4, 4], [4, 4, undefined, 4, 4, 4], []]) {
        const unscored = await assess(response(scores));
        assert.equal(unscored.quickRubric.score, null);
        assert.equal(unscored.quickRubric.neatnessWeightedFive, null);
        const fallback = await assess(response(scores, 8));
        assert.equal(fallback.quickRubric.score, 8, 'Incomplete criteria must not override a valid explicit fallback grade');
        assert.equal(fallback.quickRubric.neatnessWeightedFive, null);
        assert.equal(fallback.quickRubric.scoreBasis, 'Parsed from neatness response.');
    }
    for (const [scores, expected, weighted] of [
        [Array(6).fill(5), 10, 5], [Array(6).fill(4), 8, 4], [Array(6).fill(1), 2, 1], [[3, 4, 5, 4, 3, 2], 6, 3.4]
    ]) {
        const result = await assess(response(scores, 10, 'MIXED'));
        assert.equal(result.quickRubric.score, expected);
        assert.ok(Math.abs(result.quickRubric.neatnessWeightedFive - weighted) < 1e-10);
        assert.equal(result.quickRubric.sourceType, 'MIXED');
        assert.equal(result.quickRubric.scoreBasis, 'Computed from handwriting sub-scores.');
        assert.equal(result.quickRubric.growthTip, 'Leave clearer spaces.');
    }
    for (const type of ['TYPED_OR_PRINTED', 'NOT_SCORABLE']) {
        const result = await assess(response(Array(6).fill(5), 10, type));
        assert.equal(result.quickRubric.score, null);
        assert.equal(result.quickRubric.sourceType, type);
        assert.equal(result.quickRubric.notAssessedReason, 'Test source reason.');
    }
    assert.equal((await assess('Neatness result: 8/10.')).quickRubric.score, 8, 'Legacy numeric fallback remains supported');
    assert.equal(await assess('No usable assessment.'), null);
    console.log('Neatness scoring tests passed: missing criteria remain unscored, valid fallback grades are preserved, complete weighted scores and source exclusions remain intact.');
})().catch(error => { console.error(error); process.exitCode = 1; });
