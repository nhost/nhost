# PR Description Format Template

Reproduce this structure exactly between the reviewer markers.

```
<!-- nhost-reviewer:start -->
### **PR Type**
Enhancement

___

### **Description**
- First high-level change
- Second high-level change
- Third high-level change

___

### Diagram Walkthrough

```mermaid
flowchart LR
  A["Component A"] --> B["Component B"]
  B --> C["Component C"]
```

<details> <summary><h3> File Walkthrough</h3></summary>

<table><thead><tr><th></th><th align="left">Relevant files</th></tr></thead><tbody>
<tr><td><strong>Category name</strong></td><td><details><summary>N files</summary><table>
<tr>
  <td><strong>filename.go</strong><dd><code>Description of change</code></dd></td>
  <td><a href="https://github.com/OWNER/REPO/pull/NUMBER/files#diff-HASH">+N/-M</a></td>
</tr>
</table></details></td></tr>
</tbody></table>

</details>

___

<!-- nhost-reviewer:end -->
```
