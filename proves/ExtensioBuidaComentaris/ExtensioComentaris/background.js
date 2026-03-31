/* global angular */
// Aquesta funció s'injectarà i s'executarà directament a la pàgina
async function scriptPerInjectar(nouText) {
  let tipusPaginaGrupMateriaa = false;
  let botons = Array.from(
    document.querySelectorAll('a[data-ng-click*="showCommentsContingutsModal"]')
  ).filter(
    (boto) =>
      !boto.classList.contains('emptyIcon') &&
      !boto.hasAttribute('disabled') &&
      boto.getAttribute('data-ng-disabled') !== 'true'
  );
  if (botons.length === 0) {
    console.log('Provo a recuperar els de grup i matèria.');
    botons = Array.from(
      document.querySelectorAll('a[data-ng-click*="showDialogMoreOptions"]')
    ).filter((boto) => !boto.classList.contains('emptyIcon'));
    tipusPaginaGrupMateriaa = true;
  }
  if (botons.length === 0) {
    alert("No s'han trobat botons actius.");
    return;
  }

  for (let i = 0; i < botons.length; i++) {
    botons[i].click();

    // Espera que el modal es carregi
    await new Promise((r) => setTimeout(r, 1200));
    if (!tipusPaginaGrupMateriaa) {
      const textarea = document.querySelector(
        'textarea[data-ng-model="modalComentaris.comentaris"]'
      );
      const botoDesa = document.querySelector(
        'a[data-ng-click*="saveComentariContingut"]'
      );
      if (textarea && typeof angular !== 'undefined') {
        const scope = angular.element(textarea).scope();
        if (scope && scope.modalComentaris) {
          scope.$apply(() => {
            scope.modalComentaris.comentaris = nouText;
          });

          await new Promise((r) => setTimeout(r, 500));
          if (botoDesa) botoDesa.click();
        }
      }
    } else {
      const textarea = document.querySelector(
        'textarea[data-ng-model="commentsToModify.commentsToModifyModal"]'
      );
      const botoDesa = document.querySelector('a[data-ng-click*="modalSave"]');
      if (textarea && typeof angular !== 'undefined') {
        const scope = angular.element(textarea).scope();
        if (scope && scope.commentsToModify) {
          scope.$apply(() => {
            scope.commentsToModify.commentsToModifyModal = nouText;
          });

          await new Promise((r) => setTimeout(r, 500));
          if (botoDesa) botoDesa.click();
        }
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }
  alert('Procés finalitzat!');
}

// Escoltador del clic a la icona de l'extensió
chrome.action.onClicked.addListener(async (tab) => {
  // 1. Executem un prompt simple per demanar el text
  // Com que el prompt no es pot fer des de background, l'executem via scripting
  // //SI VOLEM PREGUNTAR A L'USUARI PER POSAR UN TEXT FIX A CADA ALUMNE
  /*   const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => prompt("Quin comentari vols posar?", "")
  });
 */
  const textUsuari = '';

  if (textUsuari != null) {
    // 2. Injectem la funció principal al món MAIN (on viu Angular)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: scriptPerInjectar,
      args: [textUsuari]
    });
  }
});
