# Text data

Word frequency lists and public-domain passages (SPEC §9). For every file added here, record the source URL and its licence.

| File               | Source                                                                                                                                                                                | Licence                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `words-ru.json`    | [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords), `content/2018/ru/ru_50k.txt` (built from [OpenSubtitles 2018](http://opus.nlpl.eu/OpenSubtitles2018.php))  | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)         |
| `passages-ru.json` | [Russian Wikisource](https://ru.wikisource.org): Chekhov «Каштанка», «Ванька», «Толстый и тонкий»; Pushkin «Метель»; Tolstoy «Кавказский пленник» (page URL stored with each passage) | Public domain (authors died before 1911; Wikisource category PD-old-70) |

## words-ru.json

Top 10 000 words of the list in frequency order, adapted by `scripts/build-words.ts`: Cyrillic only, lowercased, junk tokens and obscene words removed. As an adaptation it stays under **CC BY-SA 4.0**; credit: _Hermit Dave, FrequencyWords_. The app must show this attribution somewhere visible (e.g. Settings or footer).

Rebuild:

```bash
node scripts/build-words.ts            # downloads the source list
node scripts/build-words.ts ru_50k.txt # or uses a local copy
```

## passages-ru.json

Paragraphs of 150–420 characters from the works above, built by `scripts/build-passages.ts` (`node scripts/build-passages.ts`). Normalised to characters the course teaches: «» and „“ become `"`, dashes become `-`, stress marks and footnote asterisks are removed; paragraphs with any other character are skipped. Each entry keeps its `source` and Wikisource `url`.
