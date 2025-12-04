# Huong dan Kiem tra Tinh nang

## Danh sach Kiem tra

### 1. Phieu thu chi (So quy)

#### Kiem tra Checkbox Tinh vao hoat dong kinh doanh
1. Vao menu So quy
2. Trong form them giao dich, tim checkbox co nhan: "Tinh vao hoat dong kinh doanh (loi nhuan)"
3. Test:
   - Tao giao dich thu voi checkbox DUOC TICH -> Kiem tra trong Bao cao co tinh vao loi nhuan
   - Tao giao dich thu voi checkbox KHONG TICH -> Kiem tra trong Bao cao khong tinh vao loi nhuan, nhung so quy van tang

#### Kiem tra Quan ly Mo ta giao dich
1. Trong form them giao dich, click nut "Quan ly mo ta"
2. Modal se mo ra voi form them mo ta
3. Test:
   - Nhap mo ta moi (vi du: "Chi phi dien nuoc")
   - Chon loai: Thu tien / Chi tien / Tat ca
   - Click "Them moi" -> Mo ta se xuat hien trong dropdown
   - Xoa mo ta bang cach click nut xoa trong danh sach

#### Kiem tra Loc theo noi dung (mo ta)
1. Trong phan "Tim kiem va Loc du lieu", tim dropdown "Loc theo noi dung (mo ta)"
2. Click nut "Nap goi y" de load danh sach mo ta
3. Test:
   - Chon mot mo ta tu dropdown (vi du: "Ban hang")
   - Bang se chi hien thi cac giao dich co mo ta khop
   - Kiem tra tong thu/chi chi tinh cac giao dich da loc

#### Kiem tra Tong so tien thu/chi sau khi loc
1. Sau khi ap dung bat ky filter nao (loai, nguon, noi dung, thoi gian)
2. Kiem tra: Phia tren bang danh sach se hien thi 3 o:
   - Tong thu (theo filter) - Tong so tien thu trong ket qua loc
   - Tong chi (theo filter) - Tong so tien chi trong ket qua loc
   - So du (theo filter) - Chenh lech thu - chi
3. Test:
   - Loc theo loai "Thu" -> Chi thay Tong thu, Tong chi = 0
   - Loc theo loai "Chi" -> Chi thay Tong chi, Tong thu = 0
   - Loc theo noi dung -> Tong thu/chi chi tinh cac giao dich khop

---

### 2. Bao cao

#### Kiem tra Gia von
1. Vao menu Bao cao
2. Kiem tra: Co mot card mau vang hien thi "Gia von"
3. Gia tri nay = Tong (Gia nhap x So luong) cua tat ca san pham da xuat

#### Kiem tra Loi nhuan gop
1. Trong trang Bao cao, tim card mau xanh duong hien thi "Loi nhuan gop"
2. Kiem tra: Loi nhuan gop = Doanh thu thuan - Gia von
3. Cong thuc: Neu Doanh thu thuan = 10 trieu, Gia von = 7 trieu -> Loi nhuan gop = 3 trieu

#### Kiem tra Xuat Excel
1. Trong trang Bao cao, click nut "Xuat Excel"
2. File Excel se duoc tai ve voi ten: baocao_taichinh_{ngay_bat_dau}_{ngay_ket_thuc}.xlsx
3. Kiem tra file Excel:
   - Mo file Excel
   - Kiem tra co day du cac cot:
     - Tong doanh thu ban hang
     - Tong doanh thu tra hang
     - Doanh thu thuan
     - Gia von (Phai co)
     - Loi nhuan gop (Phai co)
     - Tong chi phi
     - Thu nhap khac
     - Loi nhuan thuan

#### Kiem tra Thu ngan chi xem chi nhanh cua minh
1. Dang nhap voi tai khoan co role "Thu ngan"
2. Vao menu Bao cao
3. Kiem tra:
   - Dropdown "Chi nhanh" bi disable (khong the chon)
   - Tu dong hien thi chi nhanh cua thu ngan
   - Co thong bao: "(Chi xem bao cao chi nhanh: {ten chi nhanh})"
   - Bao cao chi hien thi du lieu cua chi nhanh do

---

### 3. Nhap hang

#### Kiem tra Ten "Gia Tri Kho"
1. Vao menu Nhap hang
2. Kiem tra: Tim card thong ke co ten "Gia Tri Kho" (khong phai "Gia tri nhap con lai")

---

### 4. Cong no - Khach no minh

#### Kiem tra Hien thi mo ta trong lich su
1. Vao menu Cong no -> Tab "Khach no minh"
2. Click vao mot khach hang de xem Lich su
3. Kiem tra: Bang lich su co cot "Mo ta" hien thi ghi chu cua tung giao dich

#### Kiem tra Truong "Ngay no"
1. Trong bang danh sach cong no khach hang
2. Kiem tra: Co cot "Ngay no" hien thi so ngay tu ngay no den hien tai
3. Vi du: "15 ngay", "30 ngay"

#### Kiem tra Tim kiem (khong xoay khi nhap 1 ky tu)
1. Trong o tim kiem, nhap 1 ky tu (vi du: "N")
2. Kiem tra:
   - Khong co icon loading xoay ngay lap tuc
   - Cho khoang 0.5-1 giay sau khi ngung go moi tim kiem
   - Co the tiep tuc go ma khong bi gian doan

#### Kiem tra Tim theo SDT hoac Ten
1. Trong o tim kiem, nhap so dien thoai (vi du: "0123")
2. Kiem tra: Ket qua hien thi khach hang co SDT chua "0123"
3. Xoa va nhap ten khach hang (vi du: "Nguyen")
4. Kiem tra: Ket qua hien thi khach hang co ten chua "Nguyen"

---

### 5. Cong no - Minh no nha cung cap

#### Kiem tra Tra no
1. Vao menu Cong no -> Tab "Minh no nha cung cap"
2. Chon mot nha cung cap co cong no
3. Click nut "Tra no" hoac "Thanh toan"
4. Nhap so tien va click xac nhan
5. Kiem tra:
   - Giao dich tra no duoc tao thanh cong
   - So cong no cua nha cung cap giam dung so tien da tra
   - Trong So quy co giao dich chi tuong ung

#### Kiem tra Tim kiem (khong xoay khi nhap 1 ky tu)
1. Trong o tim kiem nha cung cap, nhap 1 ky tu
2. Kiem tra: Khong co icon loading xoay ngay lap tuc, cho sau khi ngung go

---

### 6. Chot xuat hang

#### Kiem tra An gia nhap cho nhan vien
1. Dang nhap voi tai khoan co role "Nhan vien ban hang"
2. Vao menu Xuat hang
3. Kiem tra:
   - Trong bang danh sach xuat hang: KHONG co cot "Gia nhap"
   - Trong dropdown chon san pham: KHONG hien thi gia nhap
   - Trong suggestions: KHONG hien thi gia nhap
4. Dang nhap voi Admin de kiem tra nguoc lai:
   - Admin se thay cot "Gia nhap" va gia nhap trong suggestions

---

### 7. Phan quyen User

#### Kiem tra Admin tong thay het
1. Dang nhap voi tai khoan Admin tong (khong co branch_id)
2. Kiem tra:
   - Co the chon tat ca chi nhanh trong dropdown
   - Xem duoc du lieu cua tat ca chi nhanh
   - Khong bi gioi han boi chi nhanh nao

#### Kiem tra Admin chi nhanh chi thay chi nhanh do
1. Dang nhap voi tai khoan Admin chi nhanh (co branch_id)
2. Kiem tra:
   - Dropdown chi nhanh chi hien thi chi nhanh cua admin
   - Chi xem duoc du lieu cua chi nhanh do
   - Khong the chon chi nhanh khac

#### Kiem tra Nhan vien chi xem xuat hang chi nhanh do
1. Dang nhap voi tai khoan Nhan vien ban hang
2. Vao menu Xuat hang
3. Kiem tra:
   - Dropdown "Chi nhanh" bi disable (khong the chon)
   - Tu dong set chi nhanh cua nhan vien
   - Chi thay danh sach xuat hang cua chi nhanh do
   - Khong the chon chi nhanh khac

#### Kiem tra Thu ngan chi xem bao cao chi nhanh do
1. Dang nhap voi tai khoan Thu ngan
2. Vao menu Bao cao
3. Kiem tra:
   - Dropdown "Chi nhanh" bi disable
   - Tu dong hien thi chi nhanh cua thu ngan
   - Bao cao chi hien thi du lieu cua chi nhanh do
   - Khong the chon chi nhanh khac

---

## Checklist Tong hop

Danh dau sau khi kiem tra tung muc:

### Phieu thu chi
- [ ] Checkbox "Tinh vao hoat dong kinh doanh" hoat dong dung
- [ ] Quan ly mo ta: Them/xoa mo ta thanh cong
- [ ] Loc theo noi dung (mo ta) hoat dong dung
- [ ] Tong thu/chi hien thi dung sau khi loc

### Bao cao
- [ ] Gia von hien thi dung
- [ ] Loi nhuan gop = Doanh thu thuan - Gia von
- [ ] Xuat Excel co day du: Gia von va Loi nhuan gop
- [ ] Thu ngan chi xem duoc chi nhanh cua minh

### Nhap hang
- [ ] Ten "Gia Tri Kho" da duoc doi

### Cong no - Khach no minh
- [ ] Lich su hien thi mo ta
- [ ] Co cot "Ngay no"
- [ ] Tim kiem khong xoay khi nhap 1 ky tu
- [ ] Tim duoc theo SDT va ten

### Cong no - Minh no nha cung cap
- [ ] Tra no thanh cong
- [ ] Tim kiem khong xoay khi nhap 1 ky tu

### Chot xuat hang
- [ ] Nhan vien khong thay gia nhap
- [ ] Admin van thay gia nhap

### Phan quyen
- [ ] Admin tong thay het
- [ ] Admin chi nhanh chi thay chi nhanh do
- [ ] Nhan vien chi xem xuat hang chi nhanh do
- [ ] Thu ngan chi xem bao cao chi nhanh do

---

## Ho tro

Neu phat hien bat ky van de nao trong qua trinh kiem tra, vui long:
1. Ghi lai man hinh (screenshot)
2. Mo ta chi tiet cac buoc thuc hien
3. Lien he doi ky thuat de duoc ho tro

---

Chuc ban kiem tra thanh cong
