# eTaabo

<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Somali Tap-to-Pay USSD</title>
<!-- Material Symbols -->
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<!-- Tailwind CSS -->
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<!-- Theme Configuration -->
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "primary": "#137fec",
                        "background-light": "#f6f7f8",
                        "background-dark": "#101922",
                    },
                    fontFamily: {
                        "display": ["Inter", "sans-serif"]
                    },
                    borderRadius: {"DEFAULT": "1rem", "lg": "2rem", "xl": "3rem", "full": "9999px"},
                },
            },
        }
    </script>
<!-- Google Fonts -->
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<style>
        body {
            font-family: 'Inter', sans-serif;
        }
        /* Custom styles to hide number input spinner */
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
            -webkit-appearance: none; 
            margin: 0; 
        }
        input[type=number] {
            -moz-appearance: textfield;
        }
    </style>
<style>
    body {
      min-height: max(884px, 100dvh);
    }
  </style>
  </head>
<body class="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center p-4">
<!-- Main Mobile Container -->
<div class="relative flex w-full max-w-[480px] flex-col overflow-hidden bg-white dark:bg-[#1a2634] rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 h-auto min-h-[600px]">
<!-- Header Section -->
<div class="relative flex flex-col items-center pt-10 pb-2 px-6">
<!-- Business Logo Placeholder -->
<div class="w-24 h-24 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center mb-5 shadow-sm border border-slate-100 dark:border-slate-600">
<span class="material-symbols-outlined text-primary text-5xl">storefront</span>
</div>
<!-- Business Name -->
<h1 class="text-slate-900 dark:text-white text-2xl font-bold tracking-tight text-center leading-tight">
                Mogadishu Market
            </h1>
<!-- Subtitle (MetaText) -->
<p class="text-[#4c739a] dark:text-slate-400 text-sm font-medium leading-normal pt-2 text-center">
                Tap to Pay – USSD Payment
            </p>
</div>
<!-- Spacer -->
<div class="h-6"></div>
<!-- Input Section (TextField) -->
<div class="flex flex-col px-6">
<label class="flex flex-col w-full">
<p class="text-slate-900 dark:text-slate-200 text-sm font-semibold leading-normal pb-3 uppercase tracking-wider text-center">Gali lacagta</p>
<div class="flex w-full items-center justify-center relative">
<!-- Custom Large Input -->
<div class="relative w-full">
<input autofocus="" class="form-input block w-full text-center text-5xl font-bold text-slate-900 dark:text-white bg-transparent border-0 border-b-2 border-slate-200 dark:border-slate-600 focus:border-primary focus:ring-0 placeholder:text-slate-300 dark:placeholder:text-slate-700 py-4 transition-colors" inputmode="decimal" placeholder="0.00" type="number" value=""/>
<!-- Currency Symbol Absolute for aesthetic if needed, but keeping it clean per request -->
</div>
</div>
</label>
</div>
<!-- Currency Indicator (MetaText) -->
<div class="flex justify-center pt-2 pb-8">
<div class="bg-slate-100 dark:bg-slate-700/50 px-3 py-1 rounded text-xs font-bold text-[#4c739a] dark:text-slate-400 uppercase tracking-widest">
                USD
            </div>
</div>
<!-- Action Button (SingleButton) -->
<div class="flex px-6 mt-auto mb-4">
<button class="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 bg-primary hover:bg-blue-600 active:bg-blue-700 transition-colors text-white text-lg font-bold leading-normal tracking-wide shadow-lg shadow-blue-500/30">
<span class="mr-2">DIR</span>
<span class="material-symbols-outlined text-[20px]">send</span>
</button>
</div>
<!-- Footer Security Note -->
<div class="flex items-center justify-center pb-6 gap-2 opacity-80">
<span class="material-symbols-outlined text-[#4c739a] dark:text-slate-500 text-[18px]">verified_user</span>
<p class="text-[#4c739a] dark:text-slate-500 text-xs font-medium">Ammaan &amp; Degdeg</p>
</div>
</div>
<!-- Background Decorative Elements (Abstract) -->
<div class="fixed top-0 left-0 w-full h-full -z-10 bg-background-light dark:bg-background-dark pointer-events-none"></div>
</body></html>

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://etaabo.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f724a56f-8bd8-4548-94c7-a9af696fffdd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
