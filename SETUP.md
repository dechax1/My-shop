# คู่มือตั้งค่า CoolPro HVAC (ใช้เวลาประมาณ 30–40 นาที)

ทุกค่าที่ต้องตั้งรวมอยู่ในไฟล์เดียวคือ **`assets/config.js`** ไม่ต้องแตะไฟล์อื่น

```
Google Sheet ─┬─ แท็บ Products  ──(Publish CSV)──▶  เว็บอ่านราคา       (ข้อ 1)
              └─ แท็บ Leads     ◀──(Apps Script)──  เว็บส่งคำขอ ──▶ LINE OA / อีเมล  (ข้อ 3)
GitHub Pages ──▶ https://dechax1.github.io/My-shop/                              (ข้อ 2)
```

---

## 1. ราคาและสเปกจริงจาก Google Sheet

แก้ราคาใน Sheet แล้วเว็บอัปเดตเอง ไม่ต้องแก้โค้ด

1. สร้าง Google Sheet ใหม่ ตั้งชื่อเช่น `CoolPro – Price & Leads`
2. **File → Import → Upload** แล้วเลือกไฟล์ `data/products-template.csv`
   → Import location: **Insert new sheet(s)** → เปลี่ยนชื่อแท็บที่ได้เป็น `Products`
3. แก้ข้อมูลตาม price list จริง (1 แถว = 1 รุ่น 1 ขนาด)

   | คอลัมน์ | ความหมาย | ตัวอย่าง |
   |---|---|---|
   | `id` | รหัสการ์ดสินค้า แถวที่ใช้ id เดียวกันจะรวมเป็นการ์ดเดียวที่มีหลายขนาด | `wf-elite` |
   | `type` | `wall` / `cassette` / `ceiling` (ใช้กับปุ่มกรอง) | `wall` |
   | `name`, `tag`, `desc` | ชื่อ, ป้ายมุมการ์ด, คำอธิบาย | `ขายดี` |
   | `feats` | จุดเด่น คั่นด้วย `\|` | `Wind-Free\|PM1.0 Filter` |
   | `model` | รหัสรุ่น (แสดงบนการ์ดและในใบเสนอราคา) | ใส่รหัสรุ่นจริง |
   | `btu` | ขนาด BTU/h | `12000` |
   | `price` | ราคารวมติดตั้งมาตรฐาน (บาท, ก่อน VAT) | `26900` |
   | `seer` | SEER (BTU/Wh) ตามฉลาก มอก. 2134 | `23` |
   | `active` | `TRUE` = แสดง, `FALSE` = ซ่อน | `TRUE` |

4. **File → Share → Publish to web** → เลือกแท็บ **Products** → รูปแบบ **Comma-separated values (.csv)** → Publish → คัดลอก URL
5. วาง URL ลงใน `assets/config.js`:
   ```js
   productsCsvUrl: "https://docs.google.com/spreadsheets/d/e/XXXX/pub?gid=YYYY&single=true&output=csv",
   ```

> ⚠️ **ทุกคนเปิดแท็บที่ Publish ได้** ห้ามใส่ต้นทุน มาร์จิ้น หรือราคา dealer ในแท็บ `Products` ให้แยกไว้แท็บอื่นที่ไม่ได้ Publish
> ⏱ Google cache ไฟล์ CSV ไว้ประมาณ 5 นาที แก้ราคาแล้วรอสักครู่ก่อนเว็บจะเปลี่ยน
> ถ้าโหลด Sheet ไม่ได้ เว็บจะใช้ข้อมูลตัวอย่างใน `assets/products.js` แทน และแสดงข้อความว่าเป็นราคาสาธิต

---

## 2. เปิดเว็บด้วย GitHub Pages

1. merge PR เข้า `main`
2. GitHub → repo **My-shop** → **Settings → Pages**
3. Source: **Deploy from a branch** → Branch: **main** / **(root)** → Save
4. รอ 1–2 นาที แล้วเว็บจะขึ้นที่ **https://dechax1.github.io/My-shop/**

ครั้งต่อไปที่ push เข้า `main` เว็บจะอัปเดตเอง ส่วนการแก้ราคาใน Sheet ไม่ต้อง push

---

## 3. ส่งคำขอใบเสนอราคาเข้า Google Sheet + แจ้งเตือน LINE OA

### 3.1 Apps Script (บันทึกลง Sheet)
1. เปิด Sheet จากข้อ 1 → **Extensions → Apps Script**
2. ลบโค้ดเดิม แล้ววางโค้ดจาก `integrations/google-apps-script/Code.gs` → Save
3. เลือกฟังก์ชัน `setup` → **Run** → อนุญาตสิทธิ์ (ระบบจะสร้างแท็บ `Leads`)
4. **Deploy → New deployment** → ⚙ เลือก **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   → Deploy → คัดลอก **Web app URL** (ลงท้ายด้วย `/exec`)
5. วางลงใน `assets/config.js`:
   ```js
   leadEndpoint: "https://script.google.com/macros/s/XXXX/exec",
   ```
6. ทดสอบ: เปิด URL `/exec` ในเบราว์เซอร์ ควรเห็น `{"ok":true,"service":"coolpro-leads",...}`

> แก้ `Code.gs` ภายหลัง → **Deploy → Manage deployments → ✏️ Edit → Version: New version** (URL เดิมยังใช้ได้)

### 3.2 แจ้งเตือนเข้า LINE (ไม่บังคับ แต่แนะนำ)
LINE Notify ปิดบริการไปแล้ว จึงใช้ **LINE Messaging API** ของ LINE OA แทน

1. สร้าง LINE Official Account (ถ้ายังไม่มี) ที่ LINE Official Account Manager
2. Settings → **Messaging API** → Enable
3. เข้า **LINE Developers Console** → เลือก channel ของ OA
   - แท็บ **Messaging API** → *Channel access token (long-lived)* → Issue → คัดลอก
   - แท็บ **Basic settings** → *Your user ID* (ขึ้นต้นด้วย `U…`) → คัดลอก
4. ใช้มือถือเพิ่ม OA ของตัวเองเป็นเพื่อน (ไม่อย่างนั้นจะ push หาตัวเองไม่ได้)
5. ใน Apps Script: **Project Settings → Script properties** → เพิ่ม
   | Property | Value |
   |---|---|
   | `LINE_CHANNEL_TOKEN` | token จากข้อ 3 |
   | `LINE_TO` | user ID จากข้อ 3 (ถ้าต้องการส่งเข้ากลุ่มทีมขาย ให้ใช้ group ID แทน) |
   | `NOTIFY_EMAIL` | (ไม่บังคับ) อีเมลที่ต้องการรับสำเนา |
6. เลือกฟังก์ชัน `testLead` → Run → ควรได้แถวใหม่ในแท็บ Leads และข้อความใน LINE

> token เก็บอยู่ฝั่ง Google เท่านั้น ไม่อยู่ในโค้ดเว็บ จึงไม่รั่วแม้ repo จะเป็น public
> แพ็กเกจฟรีของ LINE OA จำกัดจำนวนข้อความ push ต่อเดือน ให้ตรวจสอบโควตาในแพ็กเกจปัจจุบัน

### 3.3 ปุ่มแชท LINE และเบอร์โทร
```js
lineOaUrl: "https://lin.ee/XXXXXXX",   // ลิงก์เพิ่มเพื่อน OA
phone: "08x-xxx-xxxx",
```
เมื่อใส่ `lineOaUrl` แล้ว ปุ่ม "แชท LINE" สีเขียวจะขึ้นที่มุมขวาล่าง ถ้าการส่งฟอร์มล้มเหลว ระบบจะคัดลอกใบเสนอราคาและแสดงลิงก์ LINE ให้ลูกค้าส่งเองแทน

---

## 4. Checklist ก่อนส่งลิงก์ให้ลูกค้า
- [ ] ราคา, SEER, รหัสรุ่นใน Sheet ตรงกับ price list และ spec sheet ล่าสุด
- [ ] ข้อความ "ข้อมูลตัวอย่างสำหรับสาธิต" หายไปจากใต้รายการสินค้า (แปลว่าโหลด Sheet สำเร็จ)
- [ ] ส่งใบเสนอราคาทดสอบ 1 ครั้ง → ได้แถวใน Leads และข้อความใน LINE
- [ ] `quoteFooter` ใน config ตรงกับเงื่อนไขการติดตั้งจริงของร้าน
- [ ] เปิดเว็บบนมือถือแล้วตรวจหน้าตา

## การป้องกันที่มีให้แล้ว
- ช่อง honeypot กันบอตกรอกฟอร์ม
- ตรวจรูปแบบเบอร์โทรไทยทั้งฝั่งเว็บและฝั่ง Apps Script
- จำกัด 1 ครั้งต่อเบอร์ต่อนาที
- กันสูตรอันตรายใน Sheet (ข้อความที่ขึ้นต้นด้วย `= + - @`)
- escape ข้อความทุกอย่างที่มาจาก Sheet ก่อนแสดงบนเว็บ
