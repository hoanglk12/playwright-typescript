#!/usr/bin/env python3
"""Insert or replace the "Proposed Xray steps" block in one card of the GRA-5621 traceability page.

Usage: python splice-card.py <traceability.html> <TEST-KEY> <block.html>

The block file may be pretty-printed and may start with HTML comments; both are flattened away so
the card stays on its original lines. Re-running with the same block leaves the file unchanged.
"""
import io
import re
import sys

PROPOSED = "<details class='xsteps proposed' open>"
TRANSCRIBED = "<details class='xsteps'><summary>"


def load_block(path):
    text = io.open(path, encoding='utf-8').read()
    text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    block = ' '.join(line.strip() for line in text.splitlines() if line.strip())
    if not block.startswith(PROPOSED) or not block.endswith('</details>'):
        sys.exit(f'block must start with {PROPOSED} and end with </details>')
    if block.count('<details') != 1:
        sys.exit('block must not contain nested <details>')
    return block


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    html_path, key, block_path = sys.argv[1:4]
    block = load_block(block_path)
    raw = io.open(html_path, encoding='utf-8', newline='').read()

    match = re.search(r"<article class='test' id='%s'" % re.escape(key), raw)
    if not match:
        sys.exit(f'no card with id {key}')
    start = match.start()
    end = raw.index('</article>', start) + len('</article>')
    card = raw[start:end]

    if PROPOSED in card:
        i = card.index(PROPOSED)
        j = card.index('</details>', i) + len('</details>')
        new_card, action = card[:i] + block + card[j:], 'replaced the proposed block'
    elif TRANSCRIBED in card:
        i = card.index(TRANSCRIBED)
        new_card = card[:i] + block + card[i:]
        new_card = new_card.replace(TRANSCRIBED + 'Xray steps', TRANSCRIBED + 'Current Xray steps', 1)
        action = 'inserted the proposed block and renamed the transcribed steps'
    else:
        i = card.rindex('</div></article>')
        new_card, action = card[:i] + block + card[i:], 'inserted the proposed block (card had no transcribed steps)'

    if new_card == card:
        print(f'{key}: no change')
        return
    io.open(html_path, 'w', encoding='utf-8', newline='').write(raw[:start] + new_card + raw[end:])
    print(f'{key}: {action}')


if __name__ == '__main__':
    main()
