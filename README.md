# Blindspot — слепая печать

Тренажёр слепой печати на русской раскладке macOS (ISO): курс из 19 этапов — от двух букв под указательными пальцами до цифр — и тест скорости после курса. Статический сайт без сервера и аккаунтов, прогресс хранится в браузере.

Спецификация — [SPEC.md](SPEC.md).

## Запуск

Нужен Node 24 (см. `.nvmrc`).

```bash
npm install
npm run dev
```

## Команды

| Команда         | Что делает                                                 |
| --------------- | ---------------------------------------------------------- |
| `npm run dev`   | сервер разработки                                          |
| `npm run check` | типы, линтер, форматирование и unit-тесты (перед коммитом) |
| `npm run e2e`   | e2e-тесты Playwright на собранном сайте                    |
| `npm run build` | сборка в `dist/`                                           |

## Публикация

Сайт публикуется на Netlify: при каждом push в `main` Netlify запускает `npm run check && npm run build` и выкладывает `dist/` (настройки — в `netlify.toml`).

## Лицензии

Код — [MIT](LICENSE). Частотный словарь — CC BY-SA 4.0 ([Hermit Dave, FrequencyWords](https://github.com/hermitdave/FrequencyWords)), отрывки для теста — общественное достояние ([Викитека](https://ru.wikisource.org)). Подробности — в [src/data/README.md](src/data/README.md).
