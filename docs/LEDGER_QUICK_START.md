# Ledger quick start (one page, for bookkeepers)

You work in the **Ledger** page of the Purchase Requests app. It lists every purchase line that has been bought, ready for QuickBooks. Full instructions are in `docs/SOP.md` Part D.

## Each line, in order

1. **Open the receipt** (the file name in the Receipt column). It opens in a new tab. Check the vendor, date and total against the line.
2. **Choose the account.** A line starts with its category's account. Change it if QuickBooks should have another.
3. **Choose the class.** Always your choice. QuickBooks needs a class on every line, so a line cannot be Posted without one.
4. **Enter it in QuickBooks** as set out in `Clarus_Accounting_SOP.md`.
5. **Tick the line and choose Mark Posted.** The app records your name and the time. Tick many lines to post them together. If one cannot be posted, none is, and the message names it.

## The boxes

- Click a box, then choose with the mouse or the arrow keys and Enter, or type to narrow the list: a number (`6182`) or any word (`ship`, `supplies`).
- The list is in layers so the likeliest choice is on top: From this request, Used for this vendor before, Used most often, Usual for Clarus, All other accounts. The layers only set the order. Nothing is filled in for you.
- Escape closes the list and leaves the box as it was.

## Helpers

| You want to | Do this |
|---|---|
| Give many lines the same account or class | Tick them, choose the account and class in the bar that appears, choose **Apply to N**. Only what you choose changes. Posted lines are left out. If any line cannot be changed, none is. |
| See only some lines | **Show only**: Needs a class, Needs an account, Changed since posted, Administrator decides. The number beside each is how many lines it would show. |
| Change the order | **Sort by**: request, vendor, purchase date, amount. |
| Write a note | Type in the **note box** under the description and press Enter or click away. Works on Posted lines too. |
| Find a line | Search the request number, vendor, account, class or note. |
| Take the lines out | **Download Excel** saves the lines you are looking at, with clickable receipt links. |
| See how many are left | The number beside **Ledger** in the sidebar is the lines not yet Posted. |

## Warnings you will see

- **Needs a class / Needs an account** under a line's status: it cannot be posted yet.
- **Administrator decides** (amber tag): Equipment or Other, where the account depends on Max's decision and he has not confirmed it. Post it only after Max says which account.
- **Changed since posted: was $X, now $Y** (red note, and a banner at the top): the line's amount changed after you posted it, usually because a request was returned and fixed. QuickBooks may no longer agree. Check QuickBooks, then either set the line back to Not posted and post it again, or add a note saying why it stands.
- **request folder** under a receipt: an old request whose receipt link points to the request folder. It stops working once the folder is filed under its year.

## Changing something already Posted

Account and class are locked on a Posted line. Open the **Posted** tab, tick it, choose **Set back to Not posted**, change it, then post it again. A note can be written at any time.

## Safety net

A copy of the whole ledger (CSV and Markdown) is saved every night at 02:30 Central time in `Documents / App Output / Ledger_Backups` on the Forms and Apps site. Nothing in it is overwritten.

## If something looks wrong

Reload the page first. A line missing from the Ledger means its request has not been bought and packaged yet, or it was returned. Anything else: tell Max, with a screenshot.
