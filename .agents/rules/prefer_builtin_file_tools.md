# Dosya İşlemleri İçin Yerleşik Araçları (Built-in Tools) Kullanma

1. Kod dosyalarını aramak, içeriğini okumak veya güncellemek için **ASLA** `run_command` üzerinden `grep`, `cat`, `sed`, `awk` veya `echo` gibi terminal komutlarını kullanmayın.
2. Bu işlemler için her zaman sistemde tanımlı olan spesifik araçları (tools) kullanın:
   - Arama yapmak için: `grep_search`
   - Dosya okumak için: `view_file`
   - Dosya içeriğini değiştirmek için: `replace_file_content` veya `multi_replace_file_content`
   - Dizinleri listelemek için: `list_dir`
3. Terminal komutlarını (`run_command`) yalnızca derleme (build), çalıştırma (run) veya paket yönetimi (npm, yarn, tsc vb.) gibi kaçınılmaz süreçler için kullanın.
