# Ceylon Central Cabs & Delivery — Official Operations & User Manual
**A Practical Operational Guide for Business Owners, Managers, and Administrative Staff**

---

## 1. System Overview

### 1.1 Welcome to Ceylon Central Cabs & Delivery
**Ceylon Central Cabs & Delivery** is an all-in-one automated transport and delivery management platform powered by **WhatsApp**. It allows your business to receive customer bookings, calculate transparent travel fares, dispatch rides to driver groups, and manage deliveries with minimal manual effort.

The system connects three key parties seamlessly:
1. **Customers**: Interact with your automated WhatsApp business bot in their preferred language (**English**, **Sinhala**, or **Tamil**).
2. **Drivers & Riders**: Receive ride alerts, customer locations with Google Maps links, and job voice notes in specialized WhatsApp Groups.
3. **Business Owner & Admins**: Monitor orders, approve jobs, assign shop locations, and manage pricing through WhatsApp commands or the Web Dashboard.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      HOW THE PLATFORM CONNECTS EVERYONE                 │
├───────────────────┬───────────────────────────────┬─────────────────────┤
│ 1. CUSTOMERS      │ 2. YOUR BUSINESS BOT & ADMIN  │ 3. DRIVERS & RIDERS │
│ Sends ride/order  │ Calculates price, verifies    │ Receives job alerts │
│ request via       │ details, requests driver      │ & Google Maps links │
│ WhatsApp chat     │ voice note, confirms order    │ in WhatsApp groups  │
└───────────────────┴───────────────────────────────┴─────────────────────┘
```

---

## 2. Customer Booking Services & How They Work

When a customer messages your WhatsApp business number, the bot welcomes them, detects their language, and presents the main menu.

### 2.1 Service 1: Book a Ride / Cab (`HIR` Series)
Used for instant and scheduled passenger transport across all vehicle types (Motorbike, Three-Wheeler, Car, Van, Lorry, Bus).

#### Customer Booking Steps:
1. **Booking Timing**: Customer chooses **"Book Now"** (Immediate pickup) or **"Schedule for Later"**.
   - If scheduling for later, the customer simply types the date and time (e.g., *"Tomorrow 8:30 AM"*, *"Today 5:00 PM"*, or *"2026-11-10 10:00 AM"*). The system automatically understands natural time expressions.
2. **Vehicle Category**: Customer selects their preferred vehicle:
   - 🏍️ Motorbike
   - 🛺 Three-Wheeler (Tuk-Tuk)
   - 🚗 Car (Sedan / Hatchback)
   - 🚐 Van (Mini Van / KDH)
   - 🚚 Lorry (Light / Heavy transport)
   - 🚌 Bus (Commercial passenger transport)
3. **Pickup Location**: Customer sends a **WhatsApp Live Location Pin** or types a street address.
4. **Drop-off Location**: Customer sends the destination pin or address.
5. **Customer Details**: Customer confirms their name and contact phone number.
6. **Fare Calculation & Manual Confirmation Choices**:
   - The system calculates the distance, computes the fare using your vehicle pricing chart, and displays the full booking summary.
   - **Typed Confirmation Options (No Poll)**: The customer is given 3 clear options to type:
     - 1️⃣ **Yes** (Type `1` or `YES`): Confirms the booking.
     - 2️⃣ **Cancel** (Type `2` or `CANCEL`): Cancels the booking.
     - 3️⃣ **Home** (Type `3` or `HOME`): Returns to the Main Menu.
7. **Order Creation & Privacy-Protected Dispatch**:
   - Assigns a unique Order ID (e.g., **`HIR 001`**).
   - **Customer Phone Privacy**: The customer's personal phone number is sent **ONLY to the Admin**.
   - **Driver Group Dispatch**: In the **Hire Driver WhatsApp Groups**, the **Hire Admin's contact number** is displayed instead of the customer's number, protecting customer privacy while allowing drivers to contact the admin/office.
   - The Admin receives instructions on WhatsApp to confirm the driver voice note.

---

### 2.2 Service 2: Rent a Car / Hire Vehicle (`RNT` Series)
Designed for self-drive vehicle rentals, long-term hires, wedding car bookings, and fleet inquiries.

#### Customer Booking Steps:
1. **Vehicle Requirements & Description**: Customer describes what they need (e.g., *"Wagon R Automatic AC Self-Drive"* or *"KDH High-roof Van with Driver"*).
2. **Rental Duration & Dates**: Customer states how many days or weeks they need the car and the start date.
3. **Pickup / Delivery Location**: Customer sends their preferred delivery location.
4. **Customer Information**: Customer enters their name and phone number.
5. **Summary & Typed Confirmation**: Shows request summary with manual typing choices (1 for Yes, 2 for Cancel, 3 for Home).
6. **Order Dispatch**: The system creates an order code (e.g., **`RNT 001`**) and immediately forwards the request to your **Rent a Car WhatsApp Groups** so fleet owners and vehicle partners can respond.

---

### 2.3 Service 3: Delivery Service (`DEL` Series)
Designed for grocery shopping, restaurant food deliveries, parcel dispatch, medicine delivery, and local courier services.

#### Customer Booking Steps:
1. **Package Items & Category**: Customer specifies what needs to be picked up or purchased (e.g., *"Food delivery: 2x Chicken Kottu and drinks"* or *"Medicine prescription from pharmacy"*).
2. **Customer Drop-off Location**: Customer shares the home or office location where the parcel should be delivered.
3. **Delivery Timing**: Customer selects **"Deliver Now"** or **"Schedule for Later"**.
4. **Customer Information**: Customer enters their name and contact phone.
5. **Summary & Typed Confirmation**: Shows delivery order summary with manual typing choices (1 for Yes, 2 for Cancel, 3 for Home).
6. **Order Alert**: Order is created (e.g., **`DEL 001`**) and sent to the **Delivery Shop Group** and the **Admin**.

> 💡 **Why Customer Does Not Set Shop Pickup Location**:  
> Customers know where they want their items delivered, but they may not know which specific shop, pharmacy, or branch has stock. Therefore, **the Admin assigns the Shop Pickup Location** during order confirmation.

---

### 2.4 Service 4: Multilingual Information & FAQs
Customers can ask questions at any time in English, Tamil, or Sinhala.
* Categories include:
  - **Cab Services**: Rates, outstation trips, vehicle categories.
  - **Rent a Car**: Rental policies, required documents (ID, driving license), deposit rules.
  - **Delivery**: Delivery charges, size/weight limits, allowed items.
  - **General Questions**: Company contact details, bank account info, operating hours.
* You can update, add, or edit these FAQs anytime from your **Web Dashboard**.

---

### 2.5 Order Cancellation Flow
Customers can easily cancel an order before it starts:
1. Customer types `cancel`, `ரத்து`, or `අවලංගු`.
2. The bot locates their pending order and asks: *"Are you sure you want to cancel Order HIR 001? Reply YES to confirm."*
3. Once confirmed:
   - The customer receives a cancellation message.
   - The Admin is notified.
   - The driver group receives a notification that the job is cancelled so drivers do not proceed.

---

## 3. How Admins Control and Confirm Orders from WhatsApp

Admins do not need to sit in front of a computer. You can approve rides, forward driver voice notes, and assign delivery pickups directly through **WhatsApp messages**.

```
┌────────────────────────────────────────────────────────┐
│                   ADMIN DISPATCH MATRIX                │
├───────────────┬────────────────────────────────────────┤
│ Service Type  │ How Admin Confirms on WhatsApp         │
├───────────────┼────────────────────────────────────────┤
│ 1. Hire / Cab │ Order ID + Send Driver Voice Note      │
│ 2. Rent a Car │ Send Order ID (e.g. RNT 001)           │
│ 3. Delivery   │ Send Order ID + Shop Location Pin/Text │
└───────────────┴────────────────────────────────────────┘
```

---

### 3.1 Confirming Hire / Cab Orders (`HIR` Series)

To ensure drivers receive clear instructions and customer trust is maintained, **Hire / Cab orders require a Driver Voice Note before confirming to the group**.

```
[Customer Books Ride] 
       ↓
[Bot alerts Admin WhatsApp with HIR 001 details]
       ↓
[Admin types "HIR 001" or "CONFIRM HIR 001"]
       ↓
[Bot replies: "🎙️ Order HIR 001 selected. Please send Driver Voice Note now..."]
       ↓
[Admin records or forwards Driver's Voice Note]
       ↓
[Bot dispatches both Booking Text + Voice Note Audio to Hire Driver Group]
       ↓
[Bot sends Confirmation Alert to Customer WhatsApp]
```

#### Step-by-Step Instructions for Admin:
1. When a new ride booking arrives, you will receive an alert on your Admin WhatsApp showing the pickup, drop-off, vehicle, and price.
2. Reply with the Order ID:
   ```text
   HIR 001
   ```
   *(or `CONFIRM HIR 001`)*
3. The bot will respond:
   > 🎙️ *Order HIR 001 selected.*  
   > *Please send the Driver Voice Note now. Once received, the confirmed booking details and voice note will be dispatched together to the driver group.*
4. Record or forward the driver's voice note to the chat.
5. **The bot automatically**:
   - Forwards the voice note audio and the full booking details to the **Hire Driver Group**.
   - Sends a confirmation message to the customer stating that their driver has been assigned.
   - Marks the order as **Confirmed**.

---

### 3.2 Confirming Rent a Car Orders (`RNT` Series)

Rent a Car bookings do not require a voice note.

1. Review the vehicle requirements sent to your Admin WhatsApp.
2. Once you or a rental agency accepts the booking, reply with the Order ID:
   ```text
   RNT 001
   ```
   *(or `CONFIRM RNT 001`)*
3. **The bot automatically**:
   - Broadcasts a **Booked / No Longer Available** notice to the **Rent a Car Groups** in English:
     > ✅ *RENT A CAR BOOKED / CONFIRMED: RNT 001*  
     > *Vehicle: Wagon R*  
     > *Duration: 3 Days*  
     > *Location: Jaffna Town*  
     > *📌 This vehicle has been booked and confirmed. No longer available.*
   - Sends a confirmation to the customer notifying them that an agent will contact them with vehicle photos and delivery instructions.

---

### 3.3 Confirming Delivery Orders & Assigning Shop Location (`DEL` Series)

For delivery orders, the Admin tells the delivery rider which shop to collect the items from.

#### Method 1: Single Text Message with Shop Address
Reply to the bot with the order number and the shop name/location:
```text
CONFIRM DEL 001 Cargills Food City, Main Street
```
*or*
```text
DEL 001 City Pharmacy, Hospital Road
```

#### Method 2: Sending a WhatsApp Location Pin
1. Open your WhatsApp chat with the bot.
2. Tap the paperclip/attachment icon, tap **Location**, and share the **WhatsApp Location Pin** of the shop.
3. Reply with:
   ```text
   DEL 001
   ```

#### What Happens Next:
* **Dispatched to Delivery Rider Groups**:
  - 🏪 **Shop Pickup Location**: Includes an instant Google Maps link.
  - 📍 **Customer Delivery Location**: Includes an instant Google Maps link.
  - 📦 **Products to Pick Up**: Complete list of items.
  - 📞 **Customer Contact**: Customer's phone number.
* **Shop Group**: Receives notification that a rider is on the way for pickup.
* **Customer**: Receives a notification with the assigned shop name, confirming their delivery is underway.

---

### 3.4 Admin WhatsApp Quick Command Cheat Sheet

| What You Want to Do | Command to Send | What Happens |
| :--- | :--- | :--- |
| **Confirm Cab / Hire** | `HIR 001` | Bot prompts for driver voice note, then dispatches both to driver group. |
| **Send Voice Note** | *(Record / forward voice note)* | Attaches audio to selected order and forwards to driver group. |
| **Confirm Rent a Car** | `RNT 002` | Marks vehicle as booked and notifies customer and rental group. |
| **Confirm Delivery (Text)** | `CONFIRM DEL 003 Cargills Food City` | Attaches shop location and dispatches ride to delivery riders. |
| **Confirm Delivery (Pin)** | *(Send Shop Location Pin)* $\rightarrow$ `DEL 003` | Uses GPS coordinates of shop and dispatches ride to delivery riders. |
| **Cancel an Order** | `CANCEL HIR 001` | Immediately cancels the order and alerts customer and groups. |

---

## 4. Setting Up WhatsApp Groups & Adding the Bot

Your system uses **4 dedicated WhatsApp Group channels** to keep business organized:

1. 🚕 **Hire Driver Groups**: For taxi, tuk-tuk, car, van, and lorry drivers.
2. 🚗 **Rent a Car Groups**: For vehicle owners, fleet partners, and rental agencies.
3. 🏪 **Delivery Shop Groups**: For merchants, vendors, and grocery partners.
4. 🛵 **Delivery Rider Groups**: For motorbike and delivery riders who perform deliveries.

---

### 4.1 How to Connect Groups in Your Dashboard
1. Log in to your **Web Dashboard**.
2. Go to **Settings** $\rightarrow$ **System Settings** $\rightarrow$ **Multi-Service Driver Groups**.
3. Select your groups from the dropdown lists for each category:
   - *Hire Driver Groups*
   - *Rent a Car Groups*
   - *Delivery Shop Groups*
   - *Delivery Rider Groups*
4. Click **Save System Settings**.

---

### 4.2 ⚠️ CRITICAL WhatsApp Rules for the Connected Bot Number

To make sure messages and job alerts never fail, your connected WhatsApp bot number **MUST** meet these two conditions in every single group:

#### Rule 1: The Bot Number MUST Be a Member of the Group
* You must add the business phone number connected to your system into every driver and rider group.
* If the number is not in the group, WhatsApp cannot send messages to that group.

#### Rule 2: The Bot Number MUST Be Made a Group Admin (If Group is Restricted)
* Many driver groups have restricted settings:  
  **WhatsApp Group Settings $\rightarrow$ Edit Group Settings $\rightarrow$ Send Messages: Only Admins**.
* **CRITICAL**: If your group is set to *"Only Admins Can Send Messages"*, you **MUST PROMOTE YOUR BOT NUMBER TO GROUP ADMIN**.
* If the bot is only a regular member in an admin-only group, WhatsApp will block the bot from posting job alerts.

---

### 4.3 Anti-Ban Delay Protection (Safe Group Broadcasting)
Sending messages to multiple WhatsApp groups at the exact same millisecond can cause WhatsApp to flag a phone number as spam.

* In your **System Settings**, there is an **Anti-Ban Delay** setting (Default: **3 seconds**).
* When dispatching to multiple groups, the system waits 3 to 5 seconds with small random pauses between each group.
* **Keep this setting between 3 to 5 seconds** to keep your WhatsApp SIM card safe from bans.

---

## 5. Setting Up Vehicle Pricing & Travel Rates

You can adjust your travel rates anytime under **Settings** $\rightarrow$ **Vehicle Pricing Settings**.

### 5.1 Pricing Options for Each Vehicle Type
For each vehicle (Motorbike, Three-Wheeler, Car, Van, Lorry, Bus), you configure 4 simple values:

1. **Base Price (LKR)**: The minimum charge for the trip.
2. **Coverage Km**: The distance included in the base price (e.g., first 2 km or 3 km).
3. **Per Km Rate (LKR)**: The charge for each additional kilometer after the coverage distance.
4. **Discount %**: Optional discount percentage deducted from the total fare (set to `0` if no discount).

---

### 5.2 How the Pricing Works (With Real Examples)

$$\text{Extra Distance} = \text{Total Distance} - \text{Coverage Km}$$

$$\text{Fare} = \text{Base Price} + (\text{Extra Distance} \times \text{Per Km Rate}) - \text{Discount}$$

#### Example 1: Three-Wheeler Short Trip (2 Km or Less)
* **Settings**: Base Price = 300 LKR | Coverage = 2 Km | Per Km Rate = 100 LKR | Discount = 10%
* **Customer Trip**: **1.5 Km**
* **Calculation**:
  - Distance is within the 2 Km coverage, so Extra Km = 0.
  - Base Fare = 300 LKR.
  - 10% Discount = 30 LKR.
  - **Total Fare = 270 LKR**.

#### Example 2: Car Long Trip (15 Km)
* **Settings**: Base Price = 600 LKR | Coverage = 3 Km | Per Km Rate = 150 LKR | Discount = 15%
* **Customer Trip**: **15 Km**
* **Calculation**:
  - Included Distance = 3 Km.
  - Extra Distance = $15 - 3 = 12\text{ Km}$.
  - Extra Km Cost = $12 \times 150 = 1,800\text{ LKR}$.
  - Subtotal = $600 + 1,800 = 2,400\text{ LKR}$.
  - 15% Discount = 360 LKR.
  - **Total Fare = 2,040 LKR**.

---

## 6. Scheduled Trips & Special Vehicle Requests

### 6.1 Booking for Later (Scheduled Hires)
Customers can book hours or days in advance.
* Customers can type:
  - *"Tomorrow at 7:30 AM"*
  - *"Today at 4:00 PM"*
  - *"Sunday morning 9am"*
* The system saves the scheduled time and highlights it in driver groups with a special badge:  
  `⏱️ Scheduled Time: Tomorrow 7:30 AM`.

### 6.2 Custom Vehicle Descriptions
For weddings, VIP transport, large groups, or cargo transport, customers can specify special requirements during booking:
* **Air Conditioning**: AC or Non-AC.
* **Passenger Seats**: e.g., 7-seater van, 14-seater KDH, 54-passenger bus.
* **Luggage & Carriers**: Rooftop luggage carrier, extra trunk space for airport luggage.
* **Vehicle Transmission**: Automatic or Manual for self-drive rentals.
* These notes are included directly in the job dispatch message so only drivers with matching vehicles accept the booking.

---

## 7. Managing Admin Accounts & Staff Access

Your Web Dashboard provides two levels of user management:

### 7.1 Owner / Super Admin
* The primary owner account.
* Has full access to:
  1. Change vehicle pricing and discount rates.
  2. Add, remove, and link WhatsApp driver groups.
  3. Create and manage staff accounts.
  4. Connect or reconnect the business WhatsApp QR code.
  5. Receive master dispatch alerts on WhatsApp.

### 7.2 Staff / Sub-Admin Accounts
Created under **Staff Management** for your office operators, call center agents, and dispatchers.
* You can grant specific permissions to each staff member:
  * **Orders**: View customer bookings and update order status.
  * **FAQs**: Add or update answers to customer questions.
  * **Pricing**: Modify vehicle rates (if permitted).
  * **Settings**: Adjust company details and operating hours.
  * **WhatsApp**: Check if the WhatsApp session is connected.

#### Assigning Dedicated WhatsApp Numbers for Services:
In **System Settings**, you can assign different WhatsApp numbers for different operations:
* **Hire Admin Number**: Receives only taxi and cab alerts.
* **Rent Admin Number**: Receives only vehicle rental requests.
* **Delivery Admin Number**: Receives delivery orders and assigns shop locations.
* *If not configured, all alerts go to your Master Admin WhatsApp number.*

---

## 8. Simple Troubleshooting Guide for Business Owners

### Question 1: What if customer messages are not receiving replies?
* **Check WhatsApp Connection**:
  1. Open your Web Dashboard and navigate to **Settings** $\rightarrow$ **WhatsApp Settings**.
  2. Check if the status says **Connected** (Green).
  3. If it says **Disconnected**, click **Restart Session** or scan the QR code again using your business WhatsApp phone.
  4. Ensure your WhatsApp phone is turned on and connected to the internet.

### Question 2: Why are driver groups not receiving ride alerts?
* **Check Two Things**:
  1. **Is the Bot Number in the Group?** Open WhatsApp and ensure your bot number is a member of that group.
  2. **Is the Group Restricted to "Admins Only"?** If only group admins are allowed to send messages, **promote your bot number to Group Admin**.

### Question 3: Why haven't delivery riders received a delivery order?
* Delivery orders are **not sent to rider groups automatically** when the customer finishes booking.
* The Admin must confirm the **Shop Pickup Location** first (e.g. reply with `CONFIRM DEL 001 <Shop Location>` or send the Shop Location Pin). Once the shop location is assigned, the riders immediately receive the job with full Google Maps links.

---
*Manual Version: 3.0*  
*Product: Ceylon Central Cabs & Delivery*  
*Audience: Business Owners & Operating Staff*
