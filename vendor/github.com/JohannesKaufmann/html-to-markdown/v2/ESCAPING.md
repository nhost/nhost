## Escaping

Some characters have a special meaning in markdown. For example, the character "\*" can be used for lists, emphasis and dividers. By placing a backlash before that character (e.g. "\\\*") you can "escape" it. Then the character will render as a raw "\*" without the _"markdown meaning"_ applied.

But why is "escaping" even necessary?

<!-- prettier-ignore -->
```md
Paragraph 1
-
Paragraph 2
```

The markdown above doesn't seem that problematic. But "Paragraph 1" (with only one hyphen below) will be recognized as a _setext heading_.

```html
<h2>Paragraph 1</h2>
<p>Paragraph 2</p>
```

A well-placed backslash character would prevent that...

<!-- prettier-ignore -->
```md
Paragraph 1
\-
Paragraph 2
```

---

How to configure escaping? Depending on the `EscapeMode` option, the markdown output is going to be different.

```go
conv := converter.NewConverter(
    converter.WithEscapeMode("smart"), // default
    converter.WithPlugins(
        // ...
    )
)
```

Lets try it out with this HTML input:

|          |                                                       |
| -------- | ----------------------------------------------------- |
| input    | `<p>fake **bold** and real <strong>bold</strong></p>` |
|          |                                                       |
|          | **With EscapeMode "smart"**                           |
| output   | `fake \*\*bold\*\* and real **bold**`                 |
| rendered | fake \*\*bold\*\* and real **bold**                   |
|          |                                                       |
|          | **With EscapeMode "disabled"**                        |
| output   | `fake **bold** and real **bold**`                     |
| rendered | fake **bold** and real **bold**                       |

With **smart** escaping, we get some escape characters (the backlash "\\") but it renders correctly.

With escaping **disabled**, the fake and real bold can't be distinguished in the markdown. That means it is both going to render as bold.

---

So now you know the purpose of escaping. However, if you encounter some content where the escaping breaks, you can manually disable it. But please also open an issue!
