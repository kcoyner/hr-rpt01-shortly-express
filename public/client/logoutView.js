Shortly.logoutView = Backbone.View.extend({
  className: 'logout',

  template: Templates['logout'],

  render: function() {
    // this.$el.html(this.template());
    this.$el.empty();
    return this;
  }
});

